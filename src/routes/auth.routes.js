const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { protectUser, protectAgent } = require('../middleware/auth');
const ctrl = require('../controllers/auth.controller');

const router = express.Router();

router.post(
  '/register',
  [
    body('name').notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  ],
  validate,
  ctrl.register
);

router.post(
  '/login',
  [body('email').isEmail().withMessage('Valid email is required'), body('password').notEmpty().withMessage('Password is required')],
  validate,
  ctrl.login
);

router.post(
  '/ticket-access',
  [body('email').isEmail().withMessage('Valid email is required'), body('number').notEmpty().withMessage('Ticket number is required')],
  validate,
  ctrl.ticketAccess
);

router.post(
  '/agent/login',
  [body('email').isEmail().withMessage('Valid email is required'), body('password').notEmpty().withMessage('Password is required')],
  validate,
  ctrl.agentLogin
);

router.post(
  '/admin/login',
  [body('email').isEmail().withMessage('Valid email is required'), body('password').notEmpty().withMessage('Password is required')],
  validate,
  ctrl.adminLogin
);

router.post(
  '/portal-login',
  [body('email').isEmail().withMessage('Valid email is required'), body('password').notEmpty().withMessage('Password is required')],
  validate,
  ctrl.portalLogin
);

router.get('/confirm', ctrl.confirmEmail);

router.post(
  '/forgot-password',
  [body('email').isEmail().withMessage('Valid email is required')],
  validate,
  ctrl.forgotPassword
);

router.post(
  '/reset-password',
  [body('token').notEmpty().withMessage('Token is required'), body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')],
  validate,
  ctrl.resetPassword
);

router.get('/me', protectUser, ctrl.getMe);
router.put('/me', protectUser, ctrl.updateProfile);
router.get('/agent/me', protectAgent, ctrl.getAgentMe);
router.put('/agent/me', protectAgent, ctrl.updateAgentProfile);

module.exports = router;
