const cookieOptions = () => {
    const prod = (process.env.NODE_ENV || '').toUpperCase() === 'PRODUCTION';
    return {
        httpOnly: true,
        secure: prod,                    // https only in production
        sameSite: prod ? 'none' : 'lax'  // localhost:5173 -> localhost:4001 is same-site
    };
};

const sendToken = (user, statusCode, res) => {
    const token = user.getJwtToken();
    const options = {
        ...cookieOptions(),
        expires: new Date(Date.now() + Number(process.env.COOKIE_EXPIRES_TIME || 7) * 24 * 60 * 60 * 1000)
    };
    res.status(statusCode).cookie('token', token, options).json({ success: true, user });
};

sendToken.clearOptions = () => ({ ...cookieOptions(), expires: new Date(0) });
module.exports = sendToken;
