package org.example.networkdisk.annotation;

import java.lang.annotation.*;

/**
 * 日志注解
 * 用于标记需要记录日志的方法
 */
@Target({ElementType.METHOD})
@Retention(RetentionPolicy.RUNTIME)
@Documented
public @interface LogAnnotation {
    
    /**
     * 日志描述
     */
    String value() default "";
    
    /**
     * 是否记录参数
     */
    boolean logParams() default true;
    
    /**
     * 是否记录返回值
     */
    boolean logResult() default true;
    
    /**
     * 是否记录执行时间
     */
    boolean logTime() default true;
} 