import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { PersonnelController } from './personnel.controller';
import { PersonnelImportService } from './personnel-import.service';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PersonnelDto } from './dto/personnel.dto';
import * as bcrypt from 'bcrypt';

describe('UsersController', () => {
  let usersController: UsersController;
  let personnelController: PersonnelController;
  let usersService: jest.Mocked<UsersService>;

  const adminUser = { sub: 1, email: 'admin@example.com', isAdmin: true };
  const mockUser = {
    id: 2,
    name: 'Test User',
    email: 'test@example.com',
    isAdmin: false,
    isActive: true,
  };

  beforeEach(async () => {
    const mockService: Partial<jest.Mocked<UsersService>> = {
      findAll: jest.fn().mockResolvedValue([mockUser]),
      findById: jest.fn().mockResolvedValue(mockUser),
      findByEmail: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue(mockUser),
      update: jest.fn().mockResolvedValue(mockUser),
      setPassword: jest.fn().mockResolvedValue(undefined),
      remove: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController, PersonnelController],
      providers: [
        {
          provide: UsersService,
          useValue: mockService,
        },
        {
          provide: PersonnelImportService,
          useValue: {
            buildImportTemplate: jest.fn().mockResolvedValue(Buffer.from('')),
            importFromExcel: jest
              .fn()
              .mockResolvedValue({ valid: 0, errors: [], committed: false }),
          },
        },
      ],
    }).compile();

    usersController = module.get<UsersController>(UsersController);
    personnelController = module.get<PersonnelController>(PersonnelController);
    usersService = module.get(UsersService);
  });

  describe('POST /users - create user', () => {
    it('should hash password and call service.create with passwordHash (not raw password)', async () => {
      const dto: CreateUserDto = {
        name: 'New User',
        email: 'new@example.com',
        password: 'secret123',
        isAdmin: false,
        isActive: true,
      };

      await usersController.create(dto);

      expect(usersService.create).toHaveBeenCalledTimes(1);
      const callArg = usersService.create.mock.calls[0][0];

      // Raw password must NOT be passed to service
      expect(callArg).not.toHaveProperty('password');

      // passwordHash must be present and must be a bcrypt hash of the raw password
      expect(callArg).toHaveProperty('passwordHash');
      const hashMatches = await bcrypt.compare(
        'secret123',
        callArg.passwordHash as string,
      );
      expect(hashMatches).toBe(true);
    });

    it('should throw ConflictException when email already exists', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser as any);

      const dto: CreateUserDto = {
        name: 'Dup',
        email: 'test@example.com',
        password: 'secret123',
      };

      await expect(usersController.create(dto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('PATCH /users/:id - update user', () => {
    it('should throw BadRequestException when user sets own isActive=false', async () => {
      const dto: UpdateUserDto = { isActive: false };
      const selfUser = { sub: 2, email: 'test@example.com', isAdmin: false };

      await expect(usersController.update(2, dto, selfUser)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when user sets own isAdmin=false', async () => {
      const dto: UpdateUserDto = { isAdmin: false };
      const selfUser = { sub: 2, email: 'test@example.com', isAdmin: true };

      await expect(usersController.update(2, dto, selfUser)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should allow admin updating another user isActive', async () => {
      const dto: UpdateUserDto = { isActive: false };
      // adminUser has sub: 1, updating user id 2
      const result = await usersController.update(2, dto, adminUser);
      expect(usersService.update).toHaveBeenCalledWith(2, { isActive: false });
    });
  });

  describe('DELETE /users/:id', () => {
    it('should throw BadRequestException when user deletes themselves', async () => {
      const selfUser = { sub: 2, email: 'test@example.com', isAdmin: false };

      await expect(usersController.remove(2, selfUser)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should call service.remove when deleting another user', async () => {
      await usersController.remove(2, adminUser);
      expect(usersService.remove).toHaveBeenCalledWith(2);
    });
  });

  describe('PersonnelController - POST /personnel', () => {
    it('should create personnel without passwordHash', async () => {
      const dto: PersonnelDto = {
        name: 'Staff Member',
        email: 'staff@example.com',
        position: 'Engineer',
        team: 'R&D',
      };

      await personnelController.create(dto);

      expect(usersService.create).toHaveBeenCalledTimes(1);
      const callArg = usersService.create.mock.calls[0][0];

      // Must NOT have passwordHash or password
      expect(callArg).not.toHaveProperty('passwordHash');
      expect(callArg).not.toHaveProperty('password');
      expect(callArg.name).toBe('Staff Member');
      expect(callArg.email).toBe('staff@example.com');
    });
  });
});
