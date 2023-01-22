import { User } from './../entities/user.entity';
import { CreateUserDto } from './../dtos/create-user.dto';
import { CustomRepository } from 'src/database/typeorm-ex.decorator';
import { Repository } from 'typeorm';

@CustomRepository(User)
export class UsersRepository extends Repository<User> {
  async getUserByKakaoUid(kakaoUid: number): Promise<User> {
    const user = await this.findOneBy({ kakaoUid });
    return user;
  }

  async createUser(createUserDto: CreateUserDto): Promise<User> {
    const user = this.create(createUserDto);

    await this.save(user);

    return user;
  }

  async updateUserAgeRange(userId: number, ageRange: string) {
    await this.update({ id: userId }, { ageRange });
  }

  async updateUserGender(userId: number, gender: string) {
    await this.update({ id: userId }, { gender });
  }

  async updateUserRefreshToken(userId: number, refreshToken: string) {
    await this.update({ id: userId }, { refreshToken });
  }

  async deleteUserRefreshToken(userId: number) {
    await this.update({ id: userId }, { refreshToken: null });
  }

  async getUserById(userId: number): Promise<User> {
    const user = await this.findOneBy({ id: userId });
    return user;
  }
}
