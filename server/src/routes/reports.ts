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

/** Per-day calories and macros with the goal that applied on each day. */
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

/** Calories and macros rolled up per ISO week. */
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

/** Macro split in grams and as a share of energy. */
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

/** Vitamin and mineral totals for the range. */
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

/**
 * The whole report as a PDF: the same figures as the endpoints above, laid out as
 * a document. Built on the server so the numbers and the theme come from one
 * place, and so the file can be saved or sent on without a browser involved.
 */
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
    // Named explicitly so the browser can read it back off a cross-origin
    // response, which is what lets the download keep this filename.
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    res.send(buffer);
  }),
);

/** Goal versus actual totals, attributing each day to the goal in force then. */
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
