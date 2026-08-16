import { Router } from 'express';
import { asyncHandler } from '../lib/async-handler.js';
import { authenticate, requireUser } from '../middleware/auth.js';
import { handleValidation, validatedQuery } from '../middleware/validate.js';
import type { ReportRangeQuery } from '../types/dto.js';
import { reportRangeValidators } from '../validators/reports.validator.js';
import * as reportPdfService from '../services/reportPdfService.js';
import * as reportsService from '../services/reportsService.js';

export const reportsRouter = Router();

reportsRouter.use(authenticate);

reportsRouter.get(
  '/daily',
  reportRangeValidators,
  handleValidation,
  asyncHandler(async (req, res) => {
    const report = await reportsService.getDailyReport(
      requireUser(req).userId,
      validatedQuery<ReportRangeQuery>(req),
    );
    res.json(report);
  }),
);

reportsRouter.get(
  '/weekly',
  reportRangeValidators,
  handleValidation,
  asyncHandler(async (req, res) => {
    const report = await reportsService.getWeeklyReport(
      requireUser(req).userId,
      validatedQuery<ReportRangeQuery>(req),
    );
    res.json(report);
  }),
);

reportsRouter.get(
  '/macros',
  reportRangeValidators,
  handleValidation,
  asyncHandler(async (req, res) => {
    const report = await reportsService.getMacroBreakdown(
      requireUser(req).userId,
      validatedQuery<ReportRangeQuery>(req),
    );
    res.json(report);
  }),
);

reportsRouter.get(
  '/micronutrients',
  reportRangeValidators,
  handleValidation,
  asyncHandler(async (req, res) => {
    const report = await reportsService.getMicronutrientReport(
      requireUser(req).userId,
      validatedQuery<ReportRangeQuery>(req),
    );
    res.json(report);
  }),
);

reportsRouter.get(
  '/pdf',
  reportRangeValidators,
  handleValidation,
  asyncHandler(async (req, res) => {
    const { buffer, filename } = await reportPdfService.buildReportPdf(
      requireUser(req).userId,
      validatedQuery<ReportRangeQuery>(req),
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    res.send(buffer);
  }),
);

reportsRouter.get(
  '/goal-comparison',
  reportRangeValidators,
  handleValidation,
  asyncHandler(async (req, res) => {
    const report = await reportsService.getGoalComparison(
      requireUser(req).userId,
      validatedQuery<ReportRangeQuery>(req),
    );
    res.json(report);
  }),
);
