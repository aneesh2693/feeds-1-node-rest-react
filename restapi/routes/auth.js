const express = require('express');
const authController = require('../controller/auth');
const { body } = require('express-validator');
const router = express.Router();
const User = require('../model/user');
const isAuth = require('../middleware/is-auth');

//PUT /auth/signup
router.put('/signup', [
    body('email')
        .isEmail()
        .withMessage('Please enter valid email')
        .custom((value, { req }) => {
            return User.findOne({ email: value })
                .then(userDoc => {
                    if (userDoc) {
                        return Promise.reject('Email already exists!');
                    }

                })
        })
        .normalizeEmail(),
    body('password', 'Please enter valid password')
        .trim()
        .isLength({ min: 6 }),
    body('name', 'Please enter name')
        .trim()
        .not()
        .isEmpty()

], authController.signup);


// POST /auth/login
router.post('/login', [
    body('email')
        .isEmail()
        .withMessage('Please enter valid email')
        .normalizeEmail()
], authController.login);

router.get('/status', isAuth, authController.getStatus);


module.exports = router;
