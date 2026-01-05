const errorHandler = (err, req, res, next) => {
    const statusCode = res.statusCode === 200 ? 500 : res.statusCode;

    console.error('--- Backend Error Handler ---');
    console.error('Method:', req.method);
    console.error('URL:', req.originalUrl);
    console.error('Message:', err.message);
    if (err.stack) console.error('Stack:', err.stack);
    console.error('-----------------------------');

    res.status(statusCode).json({
        message: err.message,
        stack: process.env.NODE_ENV === 'production' ? null : err.stack
    });
};

const notFound = (req, res, next) => {
    const error = new Error(`Not Found - ${req.originalUrl}`);
    res.status(404);
    next(error);
};

module.exports = { errorHandler, notFound };
