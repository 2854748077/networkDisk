package org.example.networkdisk.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * 日志配置类
 */
@Configuration
@ConfigurationProperties(prefix = "app.log")
public class LogConfig {
    
    /**
     * 是否启用AOP日志
     */
    private boolean enabled = true;
    
    /**
     * 是否记录参数
     */
    private boolean logParams = true;
    
    /**
     * 是否记录返回值
     */
    private boolean logResult = true;
    
    /**
     * 是否记录执行时间
     */
    private boolean logTime = true;
    
    /**
     * 是否使用JSON格式
     */
    private boolean useJson = false;
    
    /**
     * 日志级别
     */
    private String level = "INFO";
    
    /**
     * 需要记录日志的包路径
     */
    private String[] includePackages = {"org.example.networkdisk.controller", "org.example.networkdisk.services"};
    
    /**
     * 不需要记录日志的包路径
     */
    private String[] excludePackages = {};

    // Getters and Setters
    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public boolean isLogParams() {
        return logParams;
    }

    public void setLogParams(boolean logParams) {
        this.logParams = logParams;
    }

    public boolean isLogResult() {
        return logResult;
    }

    public void setLogResult(boolean logResult) {
        this.logResult = logResult;
    }

    public boolean isLogTime() {
        return logTime;
    }

    public void setLogTime(boolean logTime) {
        this.logTime = logTime;
    }

    public boolean isUseJson() {
        return useJson;
    }

    public void setUseJson(boolean useJson) {
        this.useJson = useJson;
    }

    public String getLevel() {
        return level;
    }

    public void setLevel(String level) {
        this.level = level;
    }

    public String[] getIncludePackages() {
        return includePackages;
    }

    public void setIncludePackages(String[] includePackages) {
        this.includePackages = includePackages;
    }

    public String[] getExcludePackages() {
        return excludePackages;
    }

    public void setExcludePackages(String[] excludePackages) {
        this.excludePackages = excludePackages;
    }
} 