import { BadRequestException } from '@nestjs/common/exceptions';
import { MatchingRound } from './../matchings/constants/matching-round';
import { CreateTeamDto } from './dtos/create-team.dto';
import { forwardRef, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { TeamsRepository } from './repositories/teams.repository';
import { UsersService } from 'src/users/users.service';
import { UserTeam } from 'src/users/interfaces/user-team.interface';
import { TeamStatus } from './entities/team-status.enum';
import { TeamGender } from './entities/team-gender.enum';
import { teamPagedata } from './interfaces/team-pagedata.interface';
import { Genders } from './constants/genders';
import { Universities } from './constants/universities';
import { Areas } from './constants/areas';
import { Mbties } from './constants/mbties';
import { Roles } from './constants/roles';
import { SameUniversities } from './constants/same-universities';
import { Vibes } from './constants/vibes';
import { UpdateTeamDto } from './dtos/update-team.dto';

@Injectable()
export class TeamsService {
  constructor(
    private teamsRepository: TeamsRepository,
    @Inject(forwardRef(() => UsersService))
    private usersService: UsersService,
  ) {}

  async createTeam(createTeamDto: CreateTeamDto, userId: number): Promise<void> {
    const {
      gender,
      memberCount,
      universities,
      areas,
      intro,
      drink,
      prefSameUniversity,
      prefAge,
      prefVibes,
      availableDates,
      members,
    } = createTeamDto;

    // 이미 매칭중인 팀이 있는 경우
    const existingTeam = await this.teamsRepository.getTeamIdByUserId(userId);
    if (!!existingTeam) {
      throw new BadRequestException('team is already exists');
    }

    const user = await this.usersService.getUserById(userId);

    // 팀 정보 저장
    const { teamId } = await this.teamsRepository.createTeam(
      { gender, memberCount, universities, areas, intro, drink, prefSameUniversity, prefAge, prefVibes },
      user,
    );

    const team = await this.teamsRepository.getTeamById(teamId);

    // 팀 가능 날짜 저장
    await this.teamsRepository.createTeamAvailableDate(availableDates, team);

    // 팀 멤버 저장
    await this.teamsRepository.createTeamMember(members, team);
  }

  // 신청 내역 조회
  async getTeamsByUserId(userId: number): Promise<{ teams: UserTeam[] }> {
    const { teamsWithMatching } = await this.teamsRepository.getTeamsByUserId(userId);
    const teams = teamsWithMatching.map((t) => ({
      id: t.id,
      memberCount: t.memberCount,
      createdAt: t.createdAt,
      chatCreatedAt: (t.maleTeamMatching || t.femaleTeamMatching)?.chatCreatedAt ?? null,
    }));

    return { teams };
  }

  async getTeamIdByUserId(userId: number): Promise<{ teamId: number }> {
    return this.teamsRepository.getTeamIdByUserId(userId);
  }

  async getMembersCountOneWeek(): Promise<{ memberCount: number }> {
    return this.teamsRepository.getMembersCountOneWeek();
  }

  async getTeamsCountByStatusAndMembercountAndGender(
    status: TeamStatus.applied,
    membercount: '2' | '3',
    gender: TeamGender,
  ): Promise<{ teamCount: number }> {
    let { teamCount } = await this.teamsRepository.getTeamsCountByStatusAndMembercountAndGender(
      status,
      membercount,
      gender,
    );

    // 최소 팀 수 미만인 경우 OR 최대 팀 수 이상인 경우 값 조정
    if (teamCount < MatchingRound.MIN_TEAM) teamCount = MatchingRound.MIN_TEAM;
    if (teamCount > MatchingRound.MAX_TEAM) teamCount = MatchingRound.MAX_TEAM;

    return { teamCount };
  }

  async getTeamPagedata(): Promise<{
    Genders: teamPagedata[];
    Universities: teamPagedata[];
    Areas: teamPagedata[];
    Mbties: teamPagedata[];
    Roles: teamPagedata[];
    SameUniversities: teamPagedata[];
    Vibes: teamPagedata[];
  }> {
    return { Genders, Universities, Areas, Mbties, Roles, SameUniversities, Vibes };
  }

  async updateTeam(teamId: number, updateTeamDto: UpdateTeamDto): Promise<void> {
    const team = await this.teamsRepository.getTeamById(teamId);

    // 해당 팀 정보가 없는 경우
    if (!team || !!team.deletedAt) {
      throw new NotFoundException(`Can't find team with id ${teamId}`);
    }

    // 이미 매칭 완료된 팀인 경우
    if (!!team.maleTeamMatching || !!team.femaleTeamMatching) {
      throw new BadRequestException(`already matched team`);
    }

    // 이미 매칭 실패한 팀인 경우
    if (team.currentRound - team.startRound >= MatchingRound.MAX_TRIAL) {
      throw new BadRequestException(`matching already failed team`);
    }

    const {
      gender,
      memberCount,
      universities,
      areas,
      intro,
      drink,
      prefSameUniversity,
      prefAge,
      prefVibes,
      availableDates,
      members,
    } = updateTeamDto;

    // Team 테이블 정보 업데이트
    await this.teamsRepository.updateTeam(teamId, {
      gender,
      memberCount,
      universities,
      areas,
      intro,
      drink,
      prefSameUniversity,
      prefAge,
      prefVibes,
    });

    // 팀 가능 날짜 정보 있는 경우 row 삭제 후 다시 생성
    if (!!availableDates) {
      await this.teamsRepository.deleteTeamAvailableDateByTeamId(teamId);
      await this.teamsRepository.createTeamAvailableDate(availableDates, team);
    }

    // 팀 멤버 정보 있는 경우 row 삭제 후 다시 생성
    if (!!members) {
      await this.teamsRepository.deleteTeamMemberByTeamId(teamId);
      await this.teamsRepository.createTeamMember(members, team);
    }
  }

  async deleteTeamByTeamId(teamId: number): Promise<void> {
    const team = await this.teamsRepository.getTeamById(teamId);

    // 해당 팀 정보가 없는 경우
    if (!team || !!team.deletedAt) {
      throw new NotFoundException(`Can't find team with id ${teamId}`);
    }

    await this.teamsRepository.deleteTeamByTeamId(teamId);
  }
}
