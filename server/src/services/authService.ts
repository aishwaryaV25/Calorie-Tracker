import bcrypt from 'bcryptjs';
import type { User } from '@prisma/client';
import { conflict, notFound, unauthorized } from '../lib/errors.js';
import { signAccessToken } from '../lib/jwt.js';
import { prisma } from '../lib/prisma.js';
import type { LoginInput, SignupInput } from '../types/dto.js';

const SALT_ROUNDS = 12;

export interface PublicUser {
  id: string;
  email: string;
  displayName: string;
  createdAt: Date;
}

const toPublicUser = (user: User): PublicUser => ({
  id: user.id,
  email: user.email,
  displayName: user.displayName,
  createdAt: user.createdAt,
});

export async function signup(input: SignupInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });

  if (existing) {
    throw conflict('An account with this email already exists.');
  }

  const user = await prisma.user.create({
    data: {
      email: input.email,
      displayName: input.displayName,
      passwordHash: await bcrypt.hash(input.password, SALT_ROUNDS),
    },
  });

  return {
    user: toPublicUser(user),
    token: signAccessToken({ userId: user.id, email: user.email }),
  };
}

export async function login(input: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });

  if (!user) {
    await bcrypt.compare(input.password, `$2a$${SALT_ROUNDS}$${'.'.repeat(53)}`); // same cost as a real miss
    throw unauthorized('Incorrect email or password.');
  }

  const passwordMatches = await bcrypt.compare(input.password, user.passwordHash);

  if (!passwordMatches) {
    throw unauthorized('Incorrect email or password.');
  }

  return {
    user: toPublicUser(user),
    token: signAccessToken({ userId: user.id, email: user.email }),
  };
}

export async function getProfile(userId: string): Promise<PublicUser> {
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user) {
    throw notFound('User');
  }

  return toPublicUser(user);
}
