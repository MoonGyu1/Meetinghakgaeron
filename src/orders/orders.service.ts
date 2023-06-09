import { BadRequestException } from '@nestjs/common/exceptions';
import { TicketsService } from './../tickets/tickets.service';
import { Coupon } from 'src/coupons/entities/coupon.entity';
import { CouponTypes } from '../coupons/constants/coupons.constant';
import { Products, ProductType } from './constants/products';
import { CouponsService } from './../coupons/coupons.service';
import { CreateOrder } from './interfaces/create-order.interface';
import { CreateOrderDto } from './dtos/create-order.dto';
import { forwardRef, HttpException, Inject, Injectable, ForbiddenException } from '@nestjs/common';
import { OrdersRepository } from './repositories/orders.repository';
import { HttpService } from '@nestjs/axios';
import { catchError, firstValueFrom } from 'rxjs';
import { ConfigService } from '@nestjs/config';
import { UsersService } from 'src/users/users.service';
import * as moment from 'moment-timezone';
import { UserOrder } from 'src/users/interfaces/user-order.interface';

@Injectable()
export class OrdersService {
  constructor(
    private ordersRepository: OrdersRepository,
    private readonly httpService: HttpService,
    private configService: ConfigService,
    @Inject(forwardRef(() => UsersService))
    private usersService: UsersService,
    @Inject(forwardRef(() => CouponsService))
    private couponsService: CouponsService,
    @Inject(forwardRef(() => TicketsService))
    private ticketsService: TicketsService,
  ) {}

  // 토스 결제 승인
  async confirmTossPayments(paymentKey: string, orderId: string, amount: number): Promise<any> {
    const tossSecretKey = this.configService.get<string>('TOSS_SECRET_KEY');
    const token = Buffer.from(`${tossSecretKey}:`).toString('base64');

    const url = 'https://api.tosspayments.com/v1/payments/confirm';
    const tossData = { paymentKey, orderId, amount };
    const requestConfig = {
      headers: {
        Authorization: `Basic ${token}`,
        'Content-Type': 'application/json',
      },
    };

    const { data } = await firstValueFrom(
      this.httpService.post(url, tossData, requestConfig).pipe(
        catchError((error) => {
          throw new HttpException(error.response.data, error.response.status);
        }),
      ),
    );

    return data;
  }

  // 쿠폰 유효성 검증
  async verifyCoupon(coupon: Coupon, userId: number, productId: number): Promise<void> {
    // 유저ID 확인
    if (coupon.user.id !== userId) {
      throw new ForbiddenException('invalid coupon');
    }

    // 쿠폰을 이미 사용한 경우
    const order = await this.ordersRepository.getOrderByCouponId(coupon.id);
    if (!!order || !!coupon.usedAt) {
      throw new ForbiddenException('already used coupon');
    }

    // 쿠폰이 만료된 경우
    if (!!coupon.expiresAt) {
      const today = new Date(moment().tz('Asia/Seoul').format('YYYY-MM-DD'));
      const expiresDay = new Date(coupon.expiresAt);

      if (expiresDay < today) {
        throw new ForbiddenException('expired coupon');
      }
    }

    // 쿠폰을 적용할 수 없는 상품인 경우
    if (coupon.typeId === 1 || coupon.typeId === 2) {
      if (productId !== 1) {
        throw new ForbiddenException('invalid coupon type');
      }
    }
  }

  // 결제 금액 검증
  async verifyOrderAmount(
    productId: number,
    price: number,
    discountAmount: number,
    totalAmount: number,
    tossAmount?: number,
    coupon?: Coupon,
  ): Promise<void> {
    // 1. 상품 가격 확인
    const finalPrice = Products.find((p) => p.id === productId).price;
    if (price !== finalPrice) {
      throw new ForbiddenException('invalid price');
    }

    // 2. 쿠폰 있는 경우
    if (coupon) {
      const discountRate = CouponTypes.find((c) => c.id === coupon.typeId).discountRate;
      const finalDiscountAmount = finalPrice - finalPrice * ((100 - discountRate) / 100);
      const finalTotalAmount = finalPrice - finalDiscountAmount;

      // 할인 가격 & 최종 가격 확인
      if (discountAmount !== finalDiscountAmount || totalAmount !== finalTotalAmount) {
        throw new ForbiddenException('invalid amount');
      }

      // 토스 결제 금액이 있는 경우 결제 가격 확인
      if (!!tossAmount && tossAmount !== finalTotalAmount) {
        throw new ForbiddenException('invalid amount');
      }
    }
    // 3. 쿠폰 없는 경우
    else {
      //토스 결제 가격 확인
      if (!!tossAmount && tossAmount !== finalPrice) {
        throw new ForbiddenException('invalid amount');
      }
    }
  }

  async createOrder(userId: number, createOrderDto: CreateOrderDto): Promise<void> {
    // 쿠폰ID 있는 경우 조회
    let coupon: Coupon;

    if (!!createOrderDto.couponId) {
      coupon = await this.couponsService.getCouponById(createOrderDto.couponId);
      // 쿠폰 유효성 검증
      await this.verifyCoupon(coupon, userId, createOrderDto.productId);
    }

    // 결제 금액 검증
    await this.verifyOrderAmount(
      createOrderDto.productId,
      createOrderDto.price,
      createOrderDto.discountAmount,
      createOrderDto.totalAmount,
      createOrderDto.toss?.amount,
      coupon,
    );

    let tossConfirmedResult: any;

    // 토스페이먼츠 결제 승인 API 호출
    if (!!createOrderDto.toss) {
      const { paymentKey, orderId, amount } = createOrderDto.toss;

      tossConfirmedResult = await this.confirmTossPayments(paymentKey, orderId, amount);

      if (!!tossConfirmedResult && !tossConfirmedResult.totalAmount) {
        throw new BadRequestException('잔액이 부족합니다');
      }
    }

    const createOrderData: CreateOrder = {
      productId: createOrderDto.productId,
      price: createOrderDto.price,
      discountAmount: createOrderDto.discountAmount,
      totalAmount: createOrderDto.totalAmount,
      tossPaymentKey: tossConfirmedResult?.paymentKey ?? null,
      tossOrderId: tossConfirmedResult?.orderId ?? null,
      tossMethod: tossConfirmedResult?.method ?? null,
      tossOrderName: tossConfirmedResult?.orderName ?? null,
      tossAmount: tossConfirmedResult?.totalAmount ?? null,
    };

    const user = await this.usersService.getUserById(userId);

    // 구매 정보 저장
    const { orderId } = await this.ordersRepository.createOrder(createOrderData, user, coupon);

    // 쿠폰 사용 처리
    if (!!coupon) await this.couponsService.updateUsedAt(createOrderDto.couponId);

    // 이용권 생성 및 저장
    const order = await this.ordersRepository.getOrderById(orderId);
    const ticketCount = Products.find((p) => p.id === createOrderDto.productId).ticketCount;
    await this.ticketsService.createTickets(ticketCount, user, order);
  }

  async getOrdersByUserId(userId: number): Promise<{ orders: UserOrder[] }> {
    return this.ordersRepository.getOrdersByUserId(userId);
  }

  async getProductsPagedata(): Promise<{ Products: ProductType[] }> {
    return { Products };
  }

  async deleteOrdersByUserId(userId: number): Promise<void> {
    return this.ordersRepository.deleteOrdersByUserId(userId);
  }
}
