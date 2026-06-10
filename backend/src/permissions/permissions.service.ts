import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrudAction, SCREEN_LABELS, ScreenKey } from '../common/screen-key';
import { PermissionEntryDto } from './dto/update-permissions.dto';
import { Permission } from './permission.entity';

@Injectable()
export class PermissionsService {
  constructor(
    @InjectRepository(Permission)
    private readonly permRepo: Repository<Permission>,
  ) {}

  async hasPermission(
    userId: number,
    screen: ScreenKey,
    action: CrudAction,
  ): Promise<boolean> {
    const row = await this.permRepo.findOne({ where: { userId, screenKey: screen } });
    if (!row) return false;
    const flagMap: Record<CrudAction, keyof Permission> = {
      create: 'canCreate',
      read: 'canRead',
      update: 'canUpdate',
      delete: 'canDelete',
    };
    return row[flagMap[action]] as boolean;
  }

  async getForUser(userId: number): Promise<Permission[]> {
    const rows = await this.permRepo.find({ where: { userId } });
    const rowMap = new Map(rows.map((r) => [r.screenKey, r]));

    return Object.values(ScreenKey).map((key) => {
      if (rowMap.has(key)) return rowMap.get(key)!;
      // Return a default (all-false) entry — not persisted
      const defaultEntry = new Permission();
      defaultEntry.userId = userId;
      defaultEntry.screenKey = key;
      defaultEntry.canCreate = false;
      defaultEntry.canRead = false;
      defaultEntry.canUpdate = false;
      defaultEntry.canDelete = false;
      return defaultEntry;
    });
  }

  async replaceForUser(
    userId: number,
    entries: PermissionEntryDto[],
  ): Promise<Permission[]> {
    for (const entry of entries) {
      await this.permRepo.upsert(
        {
          userId,
          screenKey: entry.screenKey,
          canCreate: entry.canCreate,
          canRead: entry.canRead,
          canUpdate: entry.canUpdate,
          canDelete: entry.canDelete,
        },
        ['userId', 'screenKey'],
      );
    }
    return this.getForUser(userId);
  }

  getScreens(): { key: ScreenKey; label: string }[] {
    return Object.values(ScreenKey).map((key) => ({
      key,
      label: SCREEN_LABELS[key],
    }));
  }
}
