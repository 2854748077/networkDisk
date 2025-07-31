package com.easypan.controller;

import com.easypan.annotation.GlobalInterceptor;
import com.easypan.annotation.VerifyParam;
import com.easypan.component.RedisComponent;
import com.easypan.entity.config.AppConfig;
import com.easypan.entity.constants.Constants;
import com.easypan.entity.dto.CreateImageCode;
import com.easypan.entity.dto.SessionWebUserDto;
import com.easypan.entity.enums.VerifyRegexEnum;
import com.easypan.entity.po.UserInfo;
import com.easypan.entity.vo.ResponseVO;
import com.easypan.exception.BusinessException;
import com.easypan.service.EmailCodeService;
import com.easypan.service.UserInfoService;
import com.easypan.utils.OKHttpUtils;
import com.easypan.utils.StringTools;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import javax.annotation.Resource;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.HttpSession;
import java.io.File;
import java.io.IOException;
import java.io.PrintWriter;
import java.io.UnsupportedEncodingException;
import java.net.URLEncoder;
import java.util.HashMap;
import java.util.Map;

@RestController("accountController")
public class AccountController extends ABaseController {
    private static final Logger logger = LoggerFactory.getLogger(AccountController.class);

    private static final String CONTENT_TYPE = "Content-Type";
    private static final String CONTENT_TYPE_VALUE = "application/json;charset=UTF-8";


    @Resource
    private UserInfoService userInfoService;

    @Resource
    private EmailCodeService emailCodeService;

    @Resource
    private AppConfig appConfig;

    @Resource
    private RedisComponent redisComponent;

    /**
     * 验证码
     *
     * @param response
     * @param session
     * @param type
     * @throws IOException
     */
    @RequestMapping(value = "/checkCode")
    public void checkCode(HttpServletResponse response, HttpSession session, Integer type) throws
            IOException {
        CreateImageCode vCode = new CreateImageCode(130, 38, 5, 10);
        response.setHeader("Pragma", "no-cache");
        response.setHeader("Cache-Control", "no-cache");
        response.setDateHeader("Expires", 0);
        response.setContentType("image/jpeg");
        String code = vCode.getCode();
        if (type == null || type == 0) {
            session.setAttribute(Constants.CHECK_CODE_KEY, code);
        } else {
            session.setAttribute(Constants.CHECK_CODE_KEY_EMAIL, code);
        }
        vCode.write(response.getOutputStream());
    }

    /**
     * @Description: 发送邮箱验证码
     * @auther: laoluo
     * @date: 20:39 2023/4/1
     * @param: [session, email, checkCode, type]
     * @return: com.easypan.entity.vo.ResponseVO
     */
    @RequestMapping("/sendEmailCode")
    @GlobalInterceptor(checkLogin = false, checkParams = true)
    public ResponseVO sendEmailCode(HttpSession session,
                                    @VerifyParam(required = true, regex = VerifyRegexEnum.EMAIL, max = 150) String email,
                                    @VerifyParam(required = true) String checkCode,
                                    @VerifyParam(required = true) Integer type) {
        try {
            if (!checkCode.equalsIgnoreCase((String) session.getAttribute(Constants.CHECK_CODE_KEY_EMAIL))) {
                throw new BusinessException("图片验证码不正确");
            }
            emailCodeService.sendEmailCode(email, type);
            return getSuccessResponseVO(null);
        } finally {
            session.removeAttribute(Constants.CHECK_CODE_KEY_EMAIL);
        }
    }

    /**
     * @Description: 注册
     * @auther: laoluo
     * @date: 20:39 2023/4/1
     * @param: [session, email, nickName, password, checkCode, emailCode]
     * @return: com.easypan.entity.vo.ResponseVO
     */
    @RequestMapping("/register")
    @GlobalInterceptor(checkLogin = false, checkParams = true)
    public ResponseVO register(HttpSession session,
                               @VerifyParam(required = true, regex = VerifyRegexEnum.EMAIL, max = 150) String email,
                               @VerifyParam(required = true, max = 20) String nickName,
                               @VerifyParam(required = true, regex = VerifyRegexEnum.PASSWORD, min = 8, max = 18) String password,
                               @VerifyParam(required = true) String checkCode,
                               @VerifyParam(required = true) String emailCode) {
        try {
            if (!checkCode.equalsIgnoreCase((String) session.getAttribute(Constants.CHECK_CODE_KEY))) {
                throw new BusinessException("图片验证码不正确");
            }
            userInfoService.register(email, nickName, password, emailCode);
            return getSuccessResponseVO(null);
        } finally {
            session.removeAttribute(Constants.CHECK_CODE_KEY);
        }
    }

    /**
     * @Description: 登录
     * @auther: laoluo
     * @date: 20:39 2023/4/1
     * @param: [session, request, email, password, checkCode]
     * @return: com.easypan.entity.vo.ResponseVO
     */
    @RequestMapping("/login")
    @GlobalInterceptor(checkLogin = false, checkParams = true)
    public ResponseVO login(HttpSession session, HttpServletRequest request,
                            @VerifyParam(required = true) String email,
                            @VerifyParam(required = true) String password,
                            @VerifyParam(required = true) String checkCode) {
        try {
            if (!checkCode.equalsIgnoreCase((String) session.getAttribute(Constants.CHECK_CODE_KEY))) {
                throw new BusinessException("图片验证码不正确");
            }
            SessionWebUserDto sessionWebUserDto = userInfoService.login(email, password);
            session.setAttribute(Constants.SESSION_KEY, sessionWebUserDto);
            return getSuccessResponseVO(sessionWebUserDto);
        } finally {
            session.removeAttribute(Constants.CHECK_CODE_KEY);
        }
    }

    //查询数据库判断邮箱是否存在，然后校验邮箱验证码，然后创建新的 用户  然后设置密码然后存到数据库。
    @RequestMapping("/resetPwd")
    @GlobalInterceptor(checkLogin = false, checkParams = true)
    public ResponseVO resetPwd(HttpSession session,
                               @VerifyParam(required = true, regex = VerifyRegexEnum.EMAIL, max = 150) String email,
                               @VerifyParam(required = true, regex = VerifyRegexEnum.PASSWORD, min = 8, max = 18) String password,
                               @VerifyParam(required = true) String checkCode,
                               @VerifyParam(required = true) String emailCode) {
        try {
            if (!checkCode.equalsIgnoreCase((String) session.getAttribute(Constants.CHECK_CODE_KEY))) {
                throw new BusinessException("图片验证码不正确");
            }
            userInfoService.resetPwd(email, password, emailCode);
            return getSuccessResponseVO(null);
        } finally {
            session.removeAttribute(Constants.CHECK_CODE_KEY);
        }
    }


/*
* 拼接出文件夹的路径，然后判断文件夹是否存在，如果不存在则创建文件夹
* 拼接图片存储路径，然后判断是否存在，不存在者判断默认图片是否存在，存在则把头像照片设为默认图片
* 通过fileinputStream读取图片，然后fileoutputStream写入到response中
* */
    @RequestMapping("/getAvatar/{userId}")
    @GlobalInterceptor(checkLogin = false, checkParams = true)
    public void getAvatar(HttpServletResponse response, @VerifyParam(required = true) @PathVariable("userId") String userId) {
        String avatarFolderName = Constants.FILE_FOLDER_FILE + Constants.FILE_FOLDER_AVATAR_NAME;  //拼出路劲 ：/file/avatar/
        File folder = new File(appConfig.getProjectFolder() + avatarFolderName);   //拼出本地存储的地址
        if (!folder.exists()) {
            folder.mkdirs();                         //如果不存在，创建文件夹
        }

        String avatarPath = appConfig.getProjectFolder() + avatarFolderName + userId + Constants.AVATAR_SUFFIX;//拼出图片的绝对路径
        File file = new File(avatarPath);//创建文件对象
        if (!file.exists()) {
            if (!new File(appConfig.getProjectFolder() + avatarFolderName + Constants.AVATAR_DEFUALT).exists()) {
                printNoDefaultImage(response);
                return;
            }
            avatarPath = appConfig.getProjectFolder() + avatarFolderName + Constants.AVATAR_DEFUALT;
        }
        response.setContentType("image/jpg");   //设置响应内容
        readFile(response, avatarPath);         //FileoutputStream:字节数组输出流，返回图片给前端。
    }

    private void printNoDefaultImage(HttpServletResponse response) {
        response.setHeader(CONTENT_TYPE, CONTENT_TYPE_VALUE);
        response.setStatus(HttpStatus.OK.value());
        PrintWriter writer = null;
        try {
            writer = response.getWriter();
            writer.print("请在头像目录下放置默认头像default_avatar.jpg");
            writer.close();
        } catch (Exception e) {
            logger.error("输出无默认图失败", e);
        } finally {
            writer.close();
        }
    }

    //从session中获取用户信息，并返回信息前端
    @RequestMapping("/getUserInfo")
    @GlobalInterceptor
    public ResponseVO getUserInfo(HttpSession session) {
        SessionWebUserDto sessionWebUserDto = getUserInfoFromSession(session);
        return getSuccessResponseVO(sessionWebUserDto);
    }

    /*
    *
     * 从redis缓存中使用键（前缀+id）获取对应的用户空间就信息，
     * 当redis缓存中没有对应用户口空间信息，创建新的UserSpaceDto，从MySQL数据库中获取用户空间信息
     * ，并保存到redis缓存中，设置过期日期是1天。
     * 将用户空间信息返回前端
    *
    * */
    @RequestMapping("/getUseSpace")
    @GlobalInterceptor
    public ResponseVO getUseSpace(HttpSession session) {
        SessionWebUserDto sessionWebUserDto = getUserInfoFromSession(session);
        return getSuccessResponseVO(redisComponent.getUserSpaceUse(sessionWebUserDto.getUserId()));
    }


/*
*    退出登录：销毁 HttpSession对象
* */
    @RequestMapping("/logout")
    public ResponseVO logout(HttpSession session) {
        session.invalidate();
        return getSuccessResponseVO(null);
    }

    //修改用户头像
    /*
    * 创建新的文件对象，然后将MultipartFile对象保存到指定目录中（服务器）。
    * */
    @RequestMapping("/updateUserAvatar")
    @GlobalInterceptor
    public ResponseVO updateUserAvatar(HttpSession session, MultipartFile avatar) {
        SessionWebUserDto webUserDto = getUserInfoFromSession(session);
        String baseFolder = appConfig.getProjectFolder() + Constants.FILE_FOLDER_FILE;
        File targetFileFolder = new File(baseFolder + Constants.FILE_FOLDER_AVATAR_NAME);
        if (!targetFileFolder.exists()) {
            targetFileFolder.mkdirs();
        }
        File targetFile = new File(targetFileFolder.getPath() + "/" + webUserDto.getUserId() + Constants.AVATAR_SUFFIX);//  路径/id.jpg
        try {
            avatar.transferTo(targetFile);  //将前端上传的图片保存到指定目录
        } catch (Exception e) {
            logger.error("上传头像失败", e);
        }

        UserInfo userInfo = new UserInfo();
        userInfo.setQqAvatar("");
        userInfoService.updateUserInfoByUserId(userInfo, webUserDto.getUserId());
        webUserDto.setAvatar(null);
        session.setAttribute(Constants.SESSION_KEY, webUserDto);
        return getSuccessResponseVO(null);
    }


    @RequestMapping("/updatePassword")
    @GlobalInterceptor(checkParams = true)
    public ResponseVO updatePassword(HttpSession session,
                                     @VerifyParam(required = true, regex = VerifyRegexEnum.PASSWORD, min = 8, max = 18) String password) {
        SessionWebUserDto sessionWebUserDto = getUserInfoFromSession(session);
        UserInfo userInfo = new UserInfo();
        userInfo.setPassword(StringTools.encodeByMD5(password));
        userInfoService.updateUserInfoByUserId(userInfo, sessionWebUserDto.getUserId());
        return getSuccessResponseVO(null);
    }


    @RequestMapping("qqlogin")
    @GlobalInterceptor(checkLogin = false, checkParams = true)
    public ResponseVO qqlogin(HttpSession session, String callbackUrl) throws UnsupportedEncodingException {
        String state = StringTools.getRandomString(Constants.LENGTH_30);
        if (!StringTools.isEmpty(callbackUrl)) {                 //callbackUrl不为空，则保存callbackUrl，登录成功后返回该callbackUrl
            session.setAttribute(state, callbackUrl);
        }
        String url = String.format(appConfig.getQqUrlAuthorization(), appConfig.getQqAppId(), URLEncoder.encode(appConfig.getQqUrlRedirect(), "utf-8"), state);
        return getSuccessResponseVO(url);
    }

    @RequestMapping("qqlogin/callback")
    @GlobalInterceptor(checkLogin = false, checkParams = true)
    public ResponseVO qqLoginCallback(HttpSession session,
                                      @VerifyParam(required = true) String code,
                                      @VerifyParam(required = true) String state) {
        SessionWebUserDto sessionWebUserDto = userInfoService.qqLogin(code);
        session.setAttribute(Constants.SESSION_KEY, sessionWebUserDto);
        Map<String, Object> result = new HashMap<>();
        result.put("callbackUrl", session.getAttribute(state));
        result.put("userInfo", sessionWebUserDto);
        return getSuccessResponseVO(result);
    }

    @RequestMapping("githublogin")
    @GlobalInterceptor(checkLogin = false, checkParams = true)
    public ResponseVO githublogin(HttpSession session, String callbackUrl) throws UnsupportedEncodingException {
        String state = StringTools.getRandomString(Constants.LENGTH_30);
        if (!StringTools.isEmpty(callbackUrl)) {
            session.setAttribute(state, callbackUrl);
        }
        String url = String.format(appConfig.getGithubUrlAuthorization(),             // github授权登录页面URL模板
                appConfig.getGithubAppId(),                                           //Client ID
                URLEncoder.encode(appConfig.getGithubUrlRedirect(), "utf-8"),   //redirect_uri
                state);                                                                // state
        return getSuccessResponseVO(url);
    }

    @RequestMapping("githublogin/callback")
    @GlobalInterceptor(checkLogin = false, checkParams = true)
    public ResponseVO githubLoginCallback(HttpSession session,
                                         @VerifyParam(required = true) String code,
                                         @VerifyParam(required = true) String state) {
        try {
            SessionWebUserDto sessionWebUserDto = userInfoService.githubLogin(code);   //获取GitHub登录后的用户信息
            session.setAttribute(Constants.SESSION_KEY, sessionWebUserDto);            //保存用户信息到session中
            Map<String, Object> result = new HashMap<>();                             //返回结果
            result.put("callbackUrl", session.getAttribute(state));                   //回调URL（最初想要访问界面）
            result.put("userInfo", sessionWebUserDto);                                //用户信息
            return getSuccessResponseVO(result);
        } catch (Exception e) {
            logger.error("GitHub登录失败", e);
            throw e;
        }
    }



}
