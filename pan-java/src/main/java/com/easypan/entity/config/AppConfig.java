package com.easypan.entity.config;

import com.easypan.utils.StringTools;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component("appConfig")
public class AppConfig {

    private static final Logger logger = LoggerFactory.getLogger(AppConfig.class);

    /**
     * 文件目录
     */
    @Value("${project.folder:}")
    private String projectFolder;

    /**
     * 发送人
     */
    @Value("${spring.mail.username:}")
    private String sendUserName;


    @Value("${admin.emails:}")
    private String adminEmails;

    public String getAdminEmails() {
        return adminEmails;
    }

    @Value("${dev:false}")
    private Boolean dev;


    @Value("${qq.app.id:}")
    private String qqAppId;

    @Value("${qq.app.key:}")
    private String qqAppKey;


    @Value("${qq.url.authorization:}")
    private String qqUrlAuthorization;


    @Value("${qq.url.access.token:}")
    private String qqUrlAccessToken;


    @Value("${qq.url.openid:}")
    private String qqUrlOpenId;

    @Value("${qq.url.user.info:}")
    private String qqUrlUserInfo;

    @Value("${qq.url.redirect:}")
    private String qqUrlRedirect;

    // GitHub配置
    @Value("${github.app.id:}")
    private String githubAppId;

    @Value("${github.app.secret:}")
    private String githubAppSecret;

    @Value("${github.url.authorization:}")
    private String githubUrlAuthorization;

    @Value("${github.url.access.token:}")
    private String githubUrlAccessToken;

    @Value("${github.url.user.info:}")
    private String githubUrlUserInfo;

    @Value("${github.url.user.emails:}")
    private String githubUrlUserEmails;

    @Value("${github.url.redirect:}")
    private String githubUrlRedirect;


    public String getProjectFolder() {
        if (!StringTools.isEmpty(projectFolder) && !projectFolder.endsWith("/")) {
            projectFolder = projectFolder + "/";
        }
        return projectFolder;
    }

    public static Logger getLogger() {
        return logger;
    }

    public String getSendUserName() {
        return sendUserName;
    }

    public Boolean getDev() {
        return dev;
    }

    public String getQqAppId() {
        return qqAppId;
    }

    public String getQqAppKey() {
        return qqAppKey;
    }

    public String getQqUrlAuthorization() {
        return qqUrlAuthorization;
    }

    public String getQqUrlAccessToken() {
        return qqUrlAccessToken;
    }

    public String getQqUrlOpenId() {
        return qqUrlOpenId;
    }

    public String getQqUrlUserInfo() {
        return qqUrlUserInfo;
    }

    public String getQqUrlRedirect() {
        return qqUrlRedirect;
    }

    // GitHub配置的getter方法
    public String getGithubAppId() {
        return githubAppId;
    }

    public String getGithubAppSecret() {
        return githubAppSecret;
    }

    public String getGithubUrlAuthorization() {
        return githubUrlAuthorization;
    }

    public String getGithubUrlAccessToken() {
        return githubUrlAccessToken;
    }

    public String getGithubUrlUserInfo() {
        return githubUrlUserInfo;
    }

    public String getGithubUrlUserEmails() {
        return githubUrlUserEmails;
    }

    public String getGithubUrlRedirect() {
        return githubUrlRedirect;
    }
}
