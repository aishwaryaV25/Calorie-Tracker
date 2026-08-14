import { body } from 'express-validator';

const emailField = body('email')
  .trim()
  .notEmpty()
  .withMessage('Email is required.')
  .isEmail()
  .withMessage('Enter a valid email address.')
  .normalizeEmail({ gmail_remove_dots: false });

export const signupValidators = [
  emailField,
  body('password')
    .isString()
    .withMessage('Password is required.')
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be between 8 and 128 characters.'),
  body('displayName')
    .trim()
    .notEmpty()
    .withMessage('Display name is required.')
    .isLength({ max: 80 })
    .withMessage('Display name must be 80 characters or fewer.'),
];

export const loginValidators = [
  emailField,
  body('password').isString().notEmpty().withMessage('Password is required.'),
];
