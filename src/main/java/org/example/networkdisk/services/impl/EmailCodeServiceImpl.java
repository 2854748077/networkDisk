package org.example.networkdisk.services.impl;

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
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.annotation.Resource;

@Service
public class EmailCodeServiceImpl implements EmailCodeService {

    @Resource
    EmailCodeMapper<EmailCode, EmailCodeQuery> emailCodeMapper;

    @Resource
    UserInfoMapper<UserInfo, UserInfoQuery> userInfoMapper;


    @Override
    @Transactional(rollbackFor = Exception.class)
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
            EmailCode emailCode = new EmailCode();
            EmailCodeKey emailCodeKey = new EmailCodeKey();
            emailCodeKey.setEmail(email);
            emailCodeKey.setCode(code);
            emailCode.setStatus(Constants.ZERO);
            emailCode.setCreateTime(new java.util.Date());
            
            // 这里应该设置主键
            emailCode.setEmail(email);
            emailCode.setCode(code);
            
            emailCodeMapper.insert(emailCode);
            
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("发送验证码失败: " + e.getMessage());
        }
    }
}
