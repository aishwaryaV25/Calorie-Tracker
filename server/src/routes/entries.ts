import { Router } from 'express';
import { asyncHandler } from '../lib/async-handler.js';
import { pathParam } from '../lib/request.js';
import { authenticate, requireUser } from '../middleware/auth.js';
import { handleValidation, validatedBody, validatedQuery } from '../middleware/validate.js';
import type { CreateEntryInput, ListEntriesQuery, UpdateEntryInput } from '../types/dto.js';
import {
  createEntryValidators,
  entryIdValidators,
  listEntriesValidators,
  updateEntryValidators,
} from '../validators/entries.validator.js';
import * as entriesService from '../services/entriesService.js';

export const entriesRouter = Router();

// Applies to every route below, so no individual handler can forget it.
entriesRouter.use(authenticate);

entriesRouter.get(
  '/',
  listEntriesValidators,
  handleValidation,
  asyncHandler(async (req, res) => {
    const result = await entriesService.listEntries(
      requireUser(req).userId,
      validatedQuery<ListEntriesQuery>(req),
    );
    res.json(result);
  }),
);

entriesRouter.post(
  '/',
  createEntryValidators,
  handleValidation,
  asyncHandler(async (req, res) => {
    const entry = await entriesService.createEntry(
      requireUser(req).userId,
      validatedBody<CreateEntryInput>(req),
    );
    res.status(201).json(entry);
  }),
);

entriesRouter.get(
  '/:id',
  entryIdValidators,
  handleValidation,
  asyncHandler(async (req, res) => {
    res.json(await entriesService.getEntry(requireUser(req).userId, pathParam(req, 'id')));
  }),
);

entriesRouter.patch(
  '/:id',
  entryIdValidators,
  updateEntryValidators,
  handleValidation,
  asyncHandler(async (req, res) => {
    const entry = await entriesService.updateEntry(
      requireUser(req).userId,
      pathParam(req, 'id'),
      validatedBody<UpdateEntryInput>(req),
    );
    res.json(entry);
  }),
);

entriesRouter.delete(
  '/:id',
  entryIdValidators,
  handleValidation,
  asyncHandler(async (req, res) => {
    await entriesService.deleteEntry(requireUser(req).userId, pathParam(req, 'id'));
    res.status(204).send();
  }),
);
