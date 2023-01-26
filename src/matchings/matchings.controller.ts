/* eslint-disable @typescript-eslint/no-empty-function */
import { ApiOperation } from '@nestjs/swagger';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger/dist';
import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { AccessTokenGuard } from 'src/auth/guards/access-token.guard';
import { GetMatchingDto } from './dtos/get-matching.dto';
import { CreateMatchingRefuseReasonDto } from './dtos/create-matching-refuse-reason.dto';
@ApiTags('MATCHING')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Unauthorized' })
@ApiNotFoundResponse({ description: 'Not Found' })
@Controller('matchings')
export class MatchingsController {
  @ApiOperation({
    summary: '매칭 정보 조회',
    description:
      '매칭 정보가 없는 경우 null 반환 \n\n createdAt 기준 24시간 이상 초과 & 상대팀 무응답인 경우 -> 거절당함 페이지 \n\n createdAt 기준 24시간 이상 초과 & 상대팀 거절인 경우 -> 거절당함 페이지',
  })
  @ApiOkResponse({
    type: GetMatchingDto,
  })
  @Get(':matchingId')
  @UseGuards(AccessTokenGuard)
  getMatchingsMatchingId(@Param('matchingId') matchingId: number) {}

  @ApiOperation({
    summary: '매칭 수락하기',
    description: '이용권 차감됨 \n\n 거절당한 경우 이용권 환불 필요',
  })
  @ApiOkResponse({ description: 'OK' })
  @Put(':matchingId/teams/:teamId/accept')
  @UseGuards(AccessTokenGuard)
  putMatchingsMatchingIdTeamsTeamIdAccept(@Param('matchingId') matchingId: number, @Param('teamId') teamId: number) {}

  @ApiOperation({
    summary: '매칭 거절하기',
    description: '상대팀 이용권 환불 필요',
  })
  @ApiOkResponse({ description: 'OK' })
  @Put(':matchingId/teams/:teamId/refuse')
  @UseGuards(AccessTokenGuard)
  putMatchingsMatchingIdTeamsTeamIdRefuse(@Param('matchingId') matchingId: number, @Param('teamId') teamId: number) {}

  @ApiOperation({
    summary: '매칭 거절 이유 보내기',
  })
  @ApiCreatedResponse({ description: 'Created' })
  @Post(':matchingId/teams/:teamId/refuse-reason')
  @UseGuards(AccessTokenGuard)
  postMatchingsMatchingIdTeamsTeamIdRefuseReason(
    @Param('matchingId') matchingId: number,
    @Param('teamId') teamId: number,
    @Body() createMatchingRefuseReasonDto: CreateMatchingRefuseReasonDto,
  ) {}
}