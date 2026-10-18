import type { Request, Response } from "express";
import { ok, created, paginated } from "../../shared/response";
import { asyncHandler } from "../../shared/utils/async-handler";
import {
  assignTicket,
  createQueue,
  createTicket,
  getTicket,
  getTicketHistory,
  listQueues,
  listTickets,
  reopenTicket,
  replyToTicket,
  resolveTicket,
  updateQueue,
  updateTicket,
} from "../../services/saasadmin/support.service";
import type {
  AssignTicketInput,
  CreateQueueInput,
  CreateTicketInput,
  ReplyTicketInput,
  ResolveTicketInput,
  UpdateQueueInput,
  UpdateTicketInput,
} from "../../validators/saasadmin/support.validators";

const actorOf = (req: Request) => ({ actorId: req.auth?.userId ?? null, req });
const ticketIdOf = (req: Request): string => req.params.ticketId!;
const queueIdOf = (req: Request): string => req.params.queueId!;

export const listTicketsHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { rows, meta } = await listTickets(req);
    return paginated(res, rows, meta);
  },
);

export const createTicketHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const ticket = await createTicket(
      req.body as CreateTicketInput,
      actorOf(req),
    );
    return created(res, ticket, {
      message: `Support ticket ${ticket.ticketNumber} created.`,
    });
  },
);

export const getTicketHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const ticket = await getTicket(ticketIdOf(req));
    return ok(res, ticket);
  },
);

export const updateTicketHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const ticket = await updateTicket(
      ticketIdOf(req),
      req.body as UpdateTicketInput,
      actorOf(req),
    );
    return ok(res, ticket);
  },
);

export const assignTicketHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const ticket = await assignTicket(
      ticketIdOf(req),
      req.body as AssignTicketInput,
      actorOf(req),
    );
    return ok(res, ticket, { message: "Support ticket assigned." });
  },
);

export const replyToTicketHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const reply = await replyToTicket(
      ticketIdOf(req),
      req.body as ReplyTicketInput,
      actorOf(req),
    );
    return created(res, reply, {
      message: reply.isInternal ? "Internal note added." : "Reply added.",
    });
  },
);

export const resolveTicketHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const ticket = await resolveTicket(
      ticketIdOf(req),
      req.body as ResolveTicketInput,
      actorOf(req),
    );
    return ok(res, ticket, { message: "Support ticket resolved." });
  },
);

export const reopenTicketHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const ticket = await reopenTicket(ticketIdOf(req), actorOf(req));
    return ok(res, ticket, { message: "Support ticket reopened." });
  },
);

export const ticketHistoryHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const history = await getTicketHistory(ticketIdOf(req), req);
    return ok(res, history);
  },
);

export const listQueuesHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { rows, meta } = await listQueues(req);
    return paginated(res, rows, meta);
  },
);

export const createQueueHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const queue = await createQueue(req.body as CreateQueueInput, actorOf(req));
    return created(res, queue);
  },
);

export const updateQueueHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const queue = await updateQueue(
      queueIdOf(req),
      req.body as UpdateQueueInput,
      actorOf(req),
    );
    return ok(res, queue);
  },
);
