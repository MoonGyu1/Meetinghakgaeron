import { postNaverCloudSMS } from 'src/common/sms/post-navercloud-sms';
import { TeamsService } from './../../teams/teams.service';
import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { SmsType } from 'src/common/sms/enums/sms-type.enum';
import { ContentType } from 'src/common/sms/enums/content-type.enum';
import { MatchingPartnerTeamRefusedEvent } from '../events/matching-partner-team-refused.event';
import { MatchingPartnerTeamRefusedContentConstant } from 'src/common/sms/constants/matching-partner-team-refused-content.constant';

@Injectable()
export class MatchingPartnerTeamRefusedListener {
  constructor(
    @Inject(forwardRef(() => TeamsService))
    private teamsService: TeamsService,
  ) {}

  // 매칭 거절당한 유저에게 문자 보내기
  @OnEvent('matching.partnerTeamRefused', { async: true })
  async handleMatchingPartnerTeamRefusedEvent(event: MatchingPartnerTeamRefusedEvent) {
    const team = await this.teamsService.getTeamById(event.teamId);

    !team.user.deletedAt && // 회원 탈퇴한 경우 제외
      postNaverCloudSMS(
        SmsType.LMS,
        ContentType.COMM,
        team.user.phone,
        MatchingPartnerTeamRefusedContentConstant.CONTENT,
        MatchingPartnerTeamRefusedContentConstant.SUBJECT,
      );
  }
}
