import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  findAll(): Promise<User[]> {
    return this.userRepo.find();
  }

  findById(id: number): Promise<User | null> {
    return this.userRepo.findOne({ where: { id } });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { email } });
  }

  findByEmailWithPassword(email: string): Promise<User | null> {
    return this.userRepo
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email })
      .getOne();
  }

  create(data: Partial<User>): Promise<User> {
    const user = this.userRepo.create(data);
    return this.userRepo.save(user);
  }

  async update(id: number, data: Partial<User>): Promise<User | null> {
    const { passwordHash, ...safe } = data;
    const result = await this.userRepo.update(id, safe);
    if (result.affected === 0) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }
    return this.findById(id);
  }

  async setPassword(id: number, passwordHash: string): Promise<void> {
    const result = await this.userRepo.update(id, { passwordHash });
    if (result.affected === 0) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }
  }

  async remove(id: number): Promise<void> {
    const result = await this.userRepo.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }
  }
}
