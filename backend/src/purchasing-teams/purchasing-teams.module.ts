import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ComponentEntity } from '../components/component.entity';
import { User } from '../users/user.entity';
import { PurchasingTeamsController } from './purchasing-teams.controller';
import { PurchasingTeamsService } from './purchasing-teams.service';
import { PurchasingTeamMember } from './team-member.entity';
import { PurchasingTeamScope } from './team-scope.entity';
import { PurchasingTeam } from './team.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PurchasingTeam,
      PurchasingTeamMember,
      PurchasingTeamScope,
      User,
      ComponentEntity,
    ]),
  ],
  controllers: [PurchasingTeamsController],
  providers: [PurchasingTeamsService],
  exports: [PurchasingTeamsService],
})
export class PurchasingTeamsModule {}
