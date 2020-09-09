const { validationResult } = require('express-validator');
const fs = require('fs');
const path = require('path');

const io = require('../socket');
const Post = require('../model/post');
const User = require('../model/user');

exports.getPosts = async (req, res, next) => {
    const currentPage = +req.query.page || 1;
    const perPage = 2;
    try {
        const totalItems = await Post.find().countDocuments();
        const posts = await Post.find()
            .sort({ createdAt: -1 })
            .skip((currentPage - 1) * perPage)
            .limit(perPage)
            .populate('creator', 'name')

        res.status(200).json({
            message: 'Posts fetched',
            posts: posts,
            totalItems: totalItems
        });
    } catch (err) {
        if (!err.statusCode) {
            err.statusCode = 500;
        }
        next(err);
    }
};


exports.createPost = async (req, res, next) => {
    const title = req.body.title;
    const content = req.body.content;
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const error = new Error(errors.array()[0].msg);
        error.statusCode = 422;
        throw error;
    }

    if (!req.file) {
        const error = new Error('Image not provided!');
        error.statusCode = 422;
        throw error;
    }

    const imageUrl = req.file.path;
    const post = new Post({
        title: title,
        content: content,
        imageUrl: imageUrl,
        creator: req.userId
    });

    try {
        await post.save();
        const user = await User.findById(req.userId);
        user.posts.push(post);
        await user.save();
        io.getIO().emit('posts', {
            action: 'create',
            post: {
                ...post._doc,
                creator: {
                    _id: req.userId,
                    name: user.name
                }
            }
        });
        res.status(201).json({
            message: 'Post created successfully',
            post: post,
            creator: {
                _id: user._id,
                name: user.name
            }
        });
    }
    catch (err) {
        if (!err.statusCode) {
            err.statusCode = 500;
        }
        next(err);
    }
};


exports.getPost = async (req, res, next) => {
    const postId = req.params.postId;
    try {
        const post = await Post.findById(postId)
        if (!post) {
            const error = new Error('Post not found!');
            error.statusCode = 400;
            throw error;
        }
        res.status(200).json({
            message: 'Post fetched',
            post: post
        });
    }
    catch (err) {
        if (!err.statusCode) {
            err.statusCode = 500;
        }
        next(err);
    }
};


exports.updatePost = async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const error = new Error(errors.array()[0].msg);
        error.statusCode = 422;
        throw error;
    }

    const postId = req.params.postId;
    const title = req.body.title;
    const content = req.body.content;
    let imageUrl = req.body.image;

    if (req.file) {
        imageUrl = req.file.path;
    }

    if (!imageUrl) {
        const error = new Error('Image not provided!');
        error.statusCode = 422;
        throw error;
    }

    try {
        const post = await Post.findById(postId).populate('creator', 'name');
        if (!post) {
            const error = new Error('Post not found!');
            error.statusCode = 400;
            throw error;
        }

        if (post.creator._id.toString() !== req.userId) {
            const error = new Error('User not authorized to update!');
            error.statusCode = 403;
            throw error;
        }

        if (imageUrl !== post.imageUrl) {
            clearFile(post.imageUrl);
        }
        post.title = title;
        post.content = content;
        post.imageUrl = imageUrl;
        const result = await post.save();
        io.getIO().emit('posts', {
            action: 'update',
            post: result
        });
        res.status(200).json({
            message: 'Post updated',
            post: result
        });
    }
    catch (err) {
        if (!err.statusCode) {
            err.statusCode = 500;
        }
        next(err);
    }
};


exports.deletePost = async (req, res, next) => {
    try {
        const postId = req.params.postId;
        const post = await Post.findById(postId);
        if (!post) {
            const error = new Error('Post not found!');
            error.statusCode = 400;
            throw error;
        }

        if (post.creator.toString() !== req.userId) {
            const error = new Error('User not authorized to update!');
            error.statusCode = 403;
            throw error;
        }

        clearFile(post.imageUrl);
        await Post.findByIdAndDelete(postId);
        const user = await User.findById(req.userId);
        user.posts.pull(postId);
        await user.save();
        io.getIO().emit('posts', {
            action: 'delete',
            post: postId
        });
        res.status(200).json({
            message: 'Post deleted'
        });
    }
    catch (err) {
        if (!err.statusCode) {
            err.statusCode = 500;
        }
        next(err);
    }
};


// Function to clear file
const clearFile = filepath => {
    filepath = path.join(__dirname, '..', filepath);
    fs.unlink(filepath, err => {
        console.log(err)
    });
}