package org.example.networkdisk.controller;

import org.example.networkdisk.annotation.LogAnnotation;
import org.example.networkdisk.entity.constants.Constants;
import org.example.networkdisk.entity.dto.CreateImageCode;
import org.example.networkdisk.entity.vo.ResponseVo;
import org.example.networkdisk.exception.BusinessException;
import org.example.networkdisk.services.EmailCodeService;
import org.example.networkdisk.services.UserInfoService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.HttpSession;
import java.io.IOException;

@RestController("accountController")
public class accountController  extends BaseController{

    @Autowired
    @Qualifier("userInfoServiceImpl")
    private UserInfoService userInfoService;

    @Autowired
    public EmailCodeService emailCodeService;

    //传前端验证码
    @RequestMapping("/checkCode")
    @LogAnnotation("生成验证码")
    public void checkCode(HttpServletResponse response, Integer type, HttpSession session) throws IOException {

        CreateImageCode VCode = new CreateImageCode(130,38,5,10);
        response.setContentType("image/jpeg");
        response.setHeader("Pragma","No-cache");
        response.setHeader("Cache-Control","no-cache");
        response.setDateHeader("Expires",0);
        String code = VCode.getCode();
        
        // 添加调试信息
        System.out.println("生成验证码: " + code);
        System.out.println("验证码类型: " + type);
        
        if(type==0){
            session.setAttribute(Constants.CHECK_CODE_KEY,code);
            System.out.println("存储到普通验证码session: " + Constants.CHECK_CODE_KEY);
        }else{
            session.setAttribute(Constants.CHECK_CODE_KEY_EMAIL,code);
            System.out.println("存储到邮件验证码session: " + Constants.CHECK_CODE_KEY_EMAIL);
        }
        VCode.write(response.getOutputStream());

    }
    //发送邮件信息
    @RequestMapping("/sendEmailCode")
    @LogAnnotation("发送邮件验证码")
    public ResponseVo sendEmailCode(String email, String checkCode, Integer type, HttpSession session) {

        try{
            // 根据类型获取对应的session验证码
            String sessionCode;
            String sessionKey;
            if(type==null||type==0){
                sessionCode = (String) session.getAttribute(Constants.CHECK_CODE_KEY);
                sessionKey = Constants.CHECK_CODE_KEY;
            }else{
                sessionCode = (String) session.getAttribute(Constants.CHECK_CODE_KEY_EMAIL);
                sessionKey = Constants.CHECK_CODE_KEY_EMAIL;
            }
            
            // 添加调试信息
            System.out.println("前端传入的验证码: " + checkCode);
            System.out.println("Session中的验证码: " + sessionCode);
            System.out.println("验证码类型: " + type);
            System.out.println("使用的Session Key: " + sessionKey);
            
            // 检查验证码是否为空
            if (checkCode == null || checkCode.trim().isEmpty()) {
                throw new BusinessException("验证码不能为空");
            }
            
            // 检查session中的验证码是否存在
            if (sessionCode == null || sessionCode.trim().isEmpty()) {
                throw new BusinessException("验证码已过期，请重新获取");
            }
            
            // 验证码校验（忽略大小写）
            if (!checkCode.trim().equalsIgnoreCase(sessionCode.trim())) {
                throw new BusinessException("图片验证码不正确，请重新输入");
            }
            
            emailCodeService.sendEmailCode(email,type);
            return getSuccessResponseVO(null);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("发送邮件验证码失败: " + e.getMessage());
        } finally {
            // 根据类型清除对应的session验证码
            if(type==null||type==0){
                session.removeAttribute(Constants.CHECK_CODE_KEY);
            }else{
                session.removeAttribute(Constants.CHECK_CODE_KEY_EMAIL);
            }
        }
    }


}

