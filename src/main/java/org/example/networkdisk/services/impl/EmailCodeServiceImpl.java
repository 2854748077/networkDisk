package org.example.networkdisk.services.impl;

import org.example.networkdisk.entity.constants.AppConfig;
import org.example.networkdisk.entity.constants.Constants;
import org.example.networkdisk.entity.po.EmailCode;
import org.example.networkdisk.entity.po.EmailCodeKey;
import org.example.networkdisk.entity.po.UserInfo;
import org.example.networkdisk.entity.query.EmailCodeQuery;
import org.example.networkdisk.entity.query.UserInfoQuery;
import org.example.networkdisk.exception.BusinessException;
import org.example.networkdisk.mappers.EmailCodeMapper;
import org.example.networkdisk.mappers.UserInfoMapper;
import org.example.networkdisk.services.EmailCodeService;
import org.example.networkdisk.utils.StringTools;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.annotation.Resource;
import javax.mail.internet.MimeMessage;
import java.util.Date;

@Service
public class EmailCodeServiceImpl implements EmailCodeService {

    private static final Logger logger = LoggerFactory.getLogger(EmailCodeServiceImpl.class);

    @Resource
    EmailCodeMapper<EmailCode, EmailCodeQuery> emailCodeMapper;

    @Resource
    UserInfoMapper<UserInfo, UserInfoQuery> userInfoMapper;

    //发邮件用
    @Resource
    private JavaMailSender javaMailSender;
    @Resource
    AppConfig appConfig;


    @Override
    /*@Transactional(rollbackFor = Exception.class)*/
    public void sendEmailCode(String email, Integer type) {
        try {
            System.out.println("发送邮件验证码");
            
            // 验证邮箱格式
            if (email == null || email.trim().isEmpty()) {
                throw new BusinessException("邮箱地址不能为空");
            }
            
            if (type == null) {
                throw new BusinessException("验证码类型不能为空");
            }
            
            if (type == 0) {
                UserInfo userInfo = userInfoMapper.selectByEmail(email);
                if (userInfo != null) {
                    throw new BusinessException("该邮箱已注册");
                }
            }
            
            String code = StringTools.getRandomNumber(Constants.LENGTH_5);
            if (code == null) {
                throw new BusinessException("验证码生成失败");
            }
            
            //发送验证码
            sendMailCode(email, code);

            //保存验证码
            EmailCode emailCode = new EmailCode();

            emailCode.setEmail(email);
            emailCode.setCode(code);
            emailCode.setStatus(Constants.ZERO);
            emailCode.setCreateTime(new java.util.Date());

            emailCodeMapper.insert(emailCode);
            
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("发送验证码失败: " + e.getMessage());
        }
    }

    private void sendMailCode(String email, String code) {
        try {
            MimeMessage message = javaMailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true);// 支持HTML和附件
            //qq账号
            helper.setFrom(appConfig.MailUserName);
            //密码
            helper.setTo(email);
            helper.setSubject("注册验证码");
            helper.setSentDate(new Date());

            String htmlContent = "<h3>验证码：<strong>" + code + "</strong></h3>" +
                    "<p style='color:red;'>请勿将此验证码告知他人。</p>";

            helper.setText(htmlContent, true); // 启用 HTML

            javaMailSender.send(message);
            System.out.println("验证码邮件已发送至：" + email);


        }catch (Exception e){
            logger.error("发送邮件失败：" + e);
            throw new BusinessException("发送邮件失败");
        }
    }
}
