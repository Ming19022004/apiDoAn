const authService = require("../services/auth.service");
const sendResponse = require("../utils/responseFormatter");
const { MESSAGE } = require("../constants/messages");
const { STATUS } = require("../constants/httpStatusCodes");
const { AUTH } = require("../constants/auth");

// Thiết lập cookie bảo mật
const setTokenCookies = (res, accessToken, refreshToken) => {
  // Access token: httpOnly để tránh JS phía client truy cập, thời gian ngắn (1 ngày)
  res.cookie(AUTH.COOKIES.ACCESS_TOKEN, accessToken, {
    httpOnly: AUTH.COOKIES.HTTPONLY,
    secure: process.env.NODE_ENV === 'production' && AUTH.COOKIES.SECURE_IN_PRODUCTION,
    sameSite: AUTH.COOKIES.SAME_SITE,
    maxAge: AUTH.TOKEN.ACCESS_TOKEN_COOKIE_MAX_AGE
  });

  // Refresh token: httpOnly, thời gian dài hơn (30 ngày)
  res.cookie(AUTH.COOKIES.REFRESH_TOKEN, refreshToken, {
    httpOnly: AUTH.COOKIES.HTTPONLY,
    secure: process.env.NODE_ENV === 'production' && AUTH.COOKIES.SECURE_IN_PRODUCTION,
    sameSite: AUTH.COOKIES.SAME_SITE,
    path: AUTH.COOKIES.REFRESH_TOKEN_PATH,
    maxAge: AUTH.TOKEN.REFRESH_TOKEN_COOKIE_MAX_AGE
  });
};

// Xóa cookie
const clearTokenCookies = (res) => {

  res.clearCookie(AUTH.COOKIES.ACCESS_TOKEN);
  res.clearCookie(AUTH.COOKIES.REFRESH_TOKEN, { path: AUTH.COOKIES.REFRESH_TOKEN_PATH });
};

const login = async (req, res) => {
  try {
    const { email, password, pushToken } = req.body;
    console.log('Login attempt:', email, password ? '******' : 'no password');
    
    if (!email || !password) {
      return sendResponse(
        res,
        STATUS.BAD_REQUEST,
        MESSAGE.ERROR.EMAIL_PASSWORD_REQUIRED,
        null,
        false
      );
    }

    const authData = await authService.login(email, password, pushToken);
    
    // Lưu token vào cookies
    setTokenCookies(res, authData.accessToken, authData.refreshToken);
    
    // Kiểm tra User-Agent để phát hiện mobile client
    const userAgent = req.headers['user-agent'] || '';
    const isMobile = userAgent.includes('ReactNative') || 
                    req.headers['x-client-type'] === 'mobile';
    
    // Trả về thông tin user và token nếu là mobile client
    sendResponse(res, STATUS.SUCCESS, MESSAGE.SUCCESS.LOGIN_SUCCESS, {
      user: authData.user,
      accessToken: isMobile ? authData.accessToken : undefined
    });
  } catch (error) {
    console.log('Login error:', error.message);
    sendResponse(
      res,
      STATUS.UNAUTHORIZED,
      error.message || MESSAGE.ERROR.UNAUTHORIZED,
      null,
      false,
      error.message
    );
  }
};

const logout = async (req, res) => {  
  try {
    const userId = req.user.id;
    await authService.logout(userId);
    
    // Xóa cookies
    clearTokenCookies(res);
    
    sendResponse(res, STATUS.SUCCESS, MESSAGE.SUCCESS.LOGOUT);
  } catch (error) {
    sendResponse(
      res,
      STATUS.SERVER_ERROR,
      MESSAGE.ERROR.INTERNAL,
      null,
      false,
      error.message
    );
  }
};

const refresh = async (req, res) => {
  try {
    // Lấy refresh token từ cookies hoặc từ body
    let refreshToken = req.cookies[AUTH.COOKIES.REFRESH_TOKEN];
    
    // Nếu không có trong cookie, kiểm tra trong body (cho mobile client)
    if (!refreshToken && req.body.refreshToken) {
      refreshToken = req.body.refreshToken;
    }
    
    if (!refreshToken) {
      return sendResponse(
        res,
        STATUS.BAD_REQUEST,
        MESSAGE.ERROR.REFRESH_TOKEN_REQUIRED,
        null,
        false
      );
    }

    const tokens = await authService.refreshAccessToken(refreshToken);
    
    // Cập nhật cookies với token mới
    setTokenCookies(res, tokens.accessToken, tokens.refreshToken);
    
    // Kiểm tra User-Agent để phát hiện mobile client
    const userAgent = req.headers['user-agent'] || '';
    const isMobile = userAgent.includes('ReactNative') || 
                    req.headers['x-client-type'] === 'mobile';
    
    // Trả về token trong response
    sendResponse(res, STATUS.SUCCESS, MESSAGE.SUCCESS.TOKEN_REFRESHED, 
      isMobile ? { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken } : undefined
    );
  } catch (error) {
    // Nếu refresh thất bại, xóa cookies
    clearTokenCookies(res);
    
    sendResponse(
      res,
      STATUS.UNAUTHORIZED,
      error.message || MESSAGE.ERROR.UNAUTHORIZED,
      null,
      false,
      error.message
    );
  }
};

const register = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;
    
    if (!name || !email || !password) {
      return sendResponse(
        res,
        STATUS.BAD_REQUEST,
        MESSAGE.ERROR.REGISTRATION_FIELDS_REQUIRED,
        null,
        false
      );
    }

    const result = await authService.register(name, email, password, phone);
    
    // Không lưu token vào cookies vì user chưa xác thực email
    // Trả về thông báo cần xác thực email
    sendResponse(res, STATUS.CREATED, result.message, {
      user: result.user
    });
  } catch (error) {
    console.log('Registration error:', error.message);
    sendResponse(
      res,
      error.message === MESSAGE.ERROR.EMAIL_EXISTS ? STATUS.CONFLICT : STATUS.BAD_REQUEST,
      error.message || MESSAGE.ERROR.REGISTRATION_FAILED,
      null,
      false,
      error.message
    );
  }
};

const verifyEmail = async (req, res) => {
  try {
    const { email, code } = req.body;
    
    if (!email || !code) {
      return sendResponse(
        res,
        STATUS.BAD_REQUEST,
        'Email và mã xác thực là bắt buộc',
        null,
        false
      );
    }

    const result = await authService.verifyEmail(email, code);
    
    // Lưu token vào cookies sau khi xác thực thành công
    setTokenCookies(res, result.accessToken, result.refreshToken);
    
    // Kiểm tra User-Agent để phát hiện mobile client
    const userAgent = req.headers['user-agent'] || '';
    const isMobile = userAgent.includes('ReactNative') || 
                    req.headers['x-client-type'] === 'mobile';
    
    // Trả về thông tin user và token nếu là mobile client
    sendResponse(res, STATUS.SUCCESS, result.message, {
      user: result.user,
      accessToken: isMobile ? result.accessToken : undefined
    });
  } catch (error) {
    console.log('Verify email error:', error.message);
    sendResponse(
      res,
      STATUS.BAD_REQUEST,
      error.message || 'Xác thực email thất bại',
      null,
      false,
      error.message
    );
  }
};

const resendVerificationEmail = async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return sendResponse(
        res,
        STATUS.BAD_REQUEST,
        'Email là bắt buộc',
        null,
        false
      );
    }

    const result = await authService.resendVerificationEmail(email);
    sendResponse(res, STATUS.SUCCESS, result.message);
  } catch (error) {
    console.log('Resend verification email error:', error.message);
    sendResponse(
      res,
      STATUS.BAD_REQUEST,
      error.message || 'Gửi lại mã xác thực thất bại',
      null,
      false,
      error.message
    );
  }
};

const getProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const userProfile = await authService.getProfile(userId);
    sendResponse(res, STATUS.SUCCESS, MESSAGE.SUCCESS.DATA_RETRIEVED, {
      user: userProfile
    });
  } catch (error) {
    console.log('Get profile error:', error.message);
    sendResponse(
      res,
      STATUS.SERVER_ERROR,
      error.message || MESSAGE.ERROR.INTERNAL,
      null,
      false,
      error.message
    );
  }
};

const ApiAuthController = {
  login,
  logout,
  refresh,
  register,
  verifyEmail,
  resendVerificationEmail,
  getProfile
};

module.exports = ApiAuthController; 