import { Router } from 'express';
import { asyncHandler } from '../lib/async-handler.js';
import { authenticate, requireUser } from '../middleware/auth.js';
import { handleValidation, validatedBody } from '../middleware/validate.js';
import type { LoginInput, SignupInput } from '../types/dto.js';
import { loginValidators, signupValidators } from '../validators/auth.validator.js';
import * as authService from '../services/authService.js';

export const authRouter = Router();

authRouter.post(
  '/signup',
  signupValidators,
  handleValidation,
  asyncHandler(async (req, res) => {
    res.status(201).json(await authService.signup(validatedBody<SignupInput>(req)));
  }),
);

authRouter.post(
  '/login',
  loginValidators,
  handleValidation,
  asyncHandler(async (req, res) => {
    res.json(await authService.login(validatedBody<LoginInput>(req)));
  }),
);

authRouter.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    res.json({ user: await authService.getProfile(requireUser(req).userId) });
  }),
);
