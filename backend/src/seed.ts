import { NestFactory } from '@nestjs/core';
import * as bcrypt from 'bcrypt';
import { AppModule } from './app.module';
import { UsersService } from './users/users.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);

  const usersService = app.get(UsersService);

  const adminEmail = 'admin@sunny.local';
  const existing = await usersService.findByEmail(adminEmail);

  if (existing) {
    console.log(
      `[seed] Admin user already exists (id=${existing.id}). Nothing to do.`,
    );
  } else {
    const passwordHash = await bcrypt.hash('admin123', 10);
    const admin = await usersService.create({
      name: 'Quản trị viên',
      email: adminEmail,
      isAdmin: true,
      isActive: true,
      passwordHash,
    });
    console.log(
      `[seed] Created admin user (id=${admin.id}, email=${admin.email}).`,
    );
  }

  await app.close();
}

bootstrap().catch((err) => {
  console.error('[seed] Error:', err);
  process.exit(1);
});
