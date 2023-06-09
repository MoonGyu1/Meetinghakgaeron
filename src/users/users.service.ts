import { MatchingStatusConstant } from './constants/matching-status.constant';
import { MatchingRound } from './../matchings/constants/matching-round';
import { SavePhoneDto } from './../auth/dtos/save-phone.dto';
import { OrdersService } from './../orders/orders.service';
import { UserAgreement } from './entities/user-agreement.entity';
import { UserAgreementsRepository } from './repositories/user-agreements.repository';
import { CreateAgreementDto } from './dtos/create-agreement.dto';
import { UserCoupon } from './interfaces/user-coupon.interface';
import { CouponsService } from './../coupons/coupons.service';
import { TeamsService } from './../teams/teams.service';
import { InvitationsService } from './../invitations/invitations.service';
import { User } from './entities/user.entity';
import { UsersRepository } from './repositories/users.repository';
import { forwardRef, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { UserTeam } from './interfaces/user-team.interface';
import { KakaoUser } from 'src/auth/interfaces/kakao-user.interface';
import { TicketsService } from 'src/tickets/tickets.service';
import { BadRequestException } from '@nestjs/common/exceptions';
import { UserOrder } from './interfaces/user-order.interface';
import { MatchingStatus } from 'src/matchings/interfaces/matching-status.enum';
import * as moment from 'moment-timezone';
import { AdminGetUserDto } from 'src/admin/dtos/admin-get-user.dto';
import { AdminGetInvitationSuccessUserDto } from 'src/admin/dtos/admin-get-invitation-success-user.dto';

@Injectable()
export class UsersService {
  constructor(
    private usersRepository: UsersRepository,
    private userAgreementsRepository: UserAgreementsRepository,
    @Inject(forwardRef(() => InvitationsService))
    private invitationsService: InvitationsService,
    @Inject(forwardRef(() => TeamsService))
    private teamsService: TeamsService,
    @Inject(forwardRef(() => TicketsService))
    private ticketsService: TicketsService,
    @Inject(forwardRef(() => CouponsService))
    private couponsService: CouponsService,
    @Inject(forwardRef(() => OrdersService))
    private ordersService: OrdersService,
  ) {}

  async getUserByKakaoUid(kakaoUid: number): Promise<User> {
    return this.usersRepository.getUserByKakaoUid(kakaoUid);
  }

  async createUser(kakaoUser: KakaoUser): Promise<User> {
    const referralId = new Date().getTime().toString(36).toUpperCase(); // 추천인 코드 생성

    const userData = { ...kakaoUser, referralId };

    return this.usersRepository.createUser(userData);
  }

  async updateUserAgeRange(userId: number, ageRange: string) {
    return this.usersRepository.updateAgeRange(userId, ageRange);
  }

  async updateUserGender(userId: number, gender: string) {
    return this.usersRepository.updateGender(userId, gender);
  }

  async updateUserRefreshToken(userId: number, refreshToken: string) {
    return this.usersRepository.updateRefreshToken(userId, refreshToken);
  }

  async deleteUserRefreshToken(userId: number) {
    return this.usersRepository.deleteRefreshToken(userId);
  }

  async getUserById(userId: number): Promise<User> {
    return this.usersRepository.getUserById(userId);
  }

  async deleteAccount(userId: number): Promise<void> {
    return this.usersRepository.deleteAccountByUserId(userId);
  }

  async getUserByReferralId(referralId: string): Promise<User> {
    return this.usersRepository.getUserByReferralId(referralId);
  }

  async getInvitationCountByUserId(userId: number): Promise<{ invitationCount: number }> {
    let { invitationCount } = await this.invitationsService.getInvitationCountByUserId(userId);

    // 초대횟수가 4회 이상인 경우 4 반환
    if (invitationCount > 4) {
      invitationCount = 4;
    }

    return { invitationCount };
  }

  async getReferralIdByUserId(userId: number): Promise<{ referralId: string }> {
    return this.usersRepository.getReferralIdByUserId(userId);
  }

  async getMyInfoByUserId(userId: number): Promise<{ nickname: string; phone: string }> {
    return this.usersRepository.getMyInfoByUserId(userId);
  }

  async getTeamsByUserId(userId: number): Promise<{ teams: UserTeam[] }> {
    return this.teamsService.getTeamsByUserId(userId);
  }

  async updateUserPhone(userId: number, phone: SavePhoneDto): Promise<void> {
    return this.usersRepository.updateUserPhone(userId, phone);
  }

  async getTicketCountByUserId(userId: number): Promise<{ ticketCount: number }> {
    return this.ticketsService.getTicketCountByUserId(userId);
  }

  async getCouponCountByUserId(userId: number): Promise<{ couponCount: number }> {
    return this.couponsService.getCouponCountByUserId(userId);
  }

  async getCouponsByUserId(userId: number): Promise<{ coupons: UserCoupon[] }> {
    return this.couponsService.getCouponsByUserId(userId);
  }

  async createAgreement(userId: number, createAgreementDto: CreateAgreementDto): Promise<void> {
    const user = await this.usersRepository.getUserById(userId);
    const userAgreement = await this.userAgreementsRepository.getAgreementByUserId(userId);

    if (!!userAgreement) {
      throw new BadRequestException(`user agreement with user id ${userId} is already exists`);
    }

    return this.userAgreementsRepository.createAgreement(user, createAgreementDto);
  }

  async getAgreementByUserId(userId: number): Promise<UserAgreement> {
    const userAgreement = await this.userAgreementsRepository.getAgreementByUserId(userId);

    if (!userAgreement) {
      throw new NotFoundException(`Can't find user agreement with user id ${userId}`);
    }

    return userAgreement;
  }

  async getOrdersByUserId(userId: number): Promise<{ orders: UserOrder[] }> {
    return this.ordersService.getOrdersByUserId(userId);
  }

  async getTeamIdByUserId(userId: number): Promise<{ teamId: number }> {
    return this.teamsService.getTeamIdByUserId(userId);
  }

  async getUserMatchingStatusByUserId(userId: number): Promise<{ matchingStatus: MatchingStatus }> {
    const { teamId } = await this.teamsService.getTeamIdByUserId(userId);

    // CASE 0. 매칭 신청 전
    if (!teamId) {
      return { matchingStatus: null };
    }

    const team = await this.teamsService.getTeamById(teamId);
    const ourteamGender = team.gender === 1 ? 'male' : 'female';
    const matching = team[`${ourteamGender}TeamMatching`];

    // 매칭 정보 X
    if (matching === null) {
      // CASE 1. 매칭 신청 완료 - 매칭 최대 횟수 미만
      if (team.currentRound - team.startRound < MatchingRound.MAX_TRIAL) {
        return { matchingStatus: MatchingStatus.APPLIED };
      }
      // CASE 2. 매칭 실패 - 매칭 최대 횟수 이상
      else {
        return { matchingStatus: MatchingStatus.FAILED };
      }
    }

    // 매칭 정보 O
    const partnerTeamGender = team.gender === 1 ? 'female' : 'male';

    const ourteamIsAccepted = matching[`${ourteamGender}TeamIsAccepted`];
    const partnerTeamIsAccepted = matching[`${partnerTeamGender}TeamIsAccepted`];

    // CASE 3. 매칭 성공 - 상호 수락
    if (ourteamIsAccepted === true && partnerTeamIsAccepted === true) {
      return { matchingStatus: MatchingStatus.SUCCEEDED };
    }

    // CASE 4. 우리팀 거절
    if (ourteamIsAccepted === false) {
      return { matchingStatus: MatchingStatus.OURTEAM_REFUSED };
    }

    const now = new Date();
    const timeLimit = new Date(moment(matching.createdAt).add(1, 'd').format());

    // 매칭된지 24시간 이내
    if (now < timeLimit) {
      // CASE 5. 상대팀 거절
      if (partnerTeamIsAccepted === false) {
        return { matchingStatus: MatchingStatus.PARTNER_TEAM_REFUSED };
      }

      // CASE 6. 우리팀 수락
      if (ourteamIsAccepted === true) {
        return { matchingStatus: MatchingStatus.OURTEAM_ACCEPTED };
      }

      // CASE 7. 매칭 완료 - 우리팀 무응답 & 상대팀 거절 X
      return { matchingStatus: MatchingStatus.MATCHED };
    }
    // 매칭된지 24시간 이후
    else {
      // CASE 8. 우리팀 무응답
      if (ourteamIsAccepted === null) {
        return { matchingStatus: MatchingStatus.NOT_RESPONDED };
      }

      // CASE 5. 상대팀 거절 (OR 무응답)
      if (partnerTeamIsAccepted !== true) return { matchingStatus: MatchingStatus.PARTNER_TEAM_REFUSED };
    }
  }

  async getCouponCountByTypeIdAndUserId(typeId: number, userId: number): Promise<{ couponCount: number }> {
    return this.couponsService.getCouponCountByTypeIdAndUserId(typeId, userId);
  }

  async getAllUsers(): Promise<{ users: AdminGetUserDto[] }> {
    const users = await this.usersRepository.getAllUsers();
    const result = [];

    for (const u of users) {
      const { matchingStatus } = await this.getUserMatchingStatusByUserId(u.id);

      // 유저 매칭 상태
      let matchingStatusConstant: string;
      if (matchingStatus === null) {
        matchingStatusConstant = MatchingStatusConstant.NOT_APPLIED;
      } else {
        matchingStatusConstant = MatchingStatusConstant[`${matchingStatus}`];
      }

      // 유저 이용권 개수
      const { ticketCount } = await this.getTicketCountByUserId(u.id);

      // 유저 50% 쿠폰 개수
      const { couponCount: discount50CouponCount } = await this.getCouponCountByTypeIdAndUserId(1, u.id);

      // 유저 무료 쿠폰 개수
      const { couponCount: freeCouponCount } = await this.getCouponCountByTypeIdAndUserId(2, u.id);

      // 유저 친구 초대 횟수
      const { invitationCount: userInvitationCount } =
        await this.invitationsService.getInvitationCountWithDeletedByUserId(u.id);

      const user = {
        userId: u.id,
        nickname: u.nickname,
        matchingStatus: matchingStatusConstant,
        phone: u.phone,
        createdAt: u.createdAt,
        referralId: u.referralId,
        ticketCount,
        discount50CouponCount,
        freeCouponCount,
        userInvitationCount,
      };

      result.push(user);
    }

    return { users: result };
  }

  async getInvitationSuccessUsers(): Promise<{ users: AdminGetInvitationSuccessUserDto[] }> {
    return await this.invitationsService.getUsersWithInvitationCount();
  }

  async updateRefusedUserIds(userId: number, refusedUserIds: number[]) {
    return this.usersRepository.updateRefusedUserIds(userId, refusedUserIds);
  }
}
