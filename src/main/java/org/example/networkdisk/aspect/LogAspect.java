package org.example.networkdisk.aspect;

import org.example.networkdisk.annotation.LogAnnotation;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.annotation.Pointcut;
import org.aspectj.lang.reflect.MethodSignature;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import javax.servlet.http.HttpServletRequest;
import java.lang.reflect.Method;
import java.util.Arrays;

/**
 * AOP日志切面
 * 用于记录方法调用、参数、返回值和执行时间
 */
@Aspect
@Component
public class LogAspect {

    /**
     * 定义切点 - 所有Controller方法
     */
/*
    @Pointcut("execution(* org.example.networkdisk.controller..*.*(..))")
    public void controllerLog() {}
*/

    /**
     * 定义切点 - 所有Service方法
     */
    /*@Pointcut("execution(* org.example.networkdisk.services..*.*(..))")
    public void serviceLog() {}
*/
    /**
     * 定义切点 - 带有@LogAnnotation注解的方法
     */
    @Pointcut("@annotation(org.example.networkdisk.annotation.LogAnnotation)")
    public void annotationLog() {}

    /**
     * 环绕通知 - 记录方法调用日志
     */
    @Around("annotationLog()")
    public Object around(ProceedingJoinPoint joinPoint) throws Throwable {
        long startTime = System.currentTimeMillis();
        
        // 获取方法信息
        MethodSignature signature = (MethodSignature) joinPoint.getSignature();
        Method method = signature.getMethod();
        String methodName = method.getName();
        String className = method.getDeclaringClass().getSimpleName();
        
        // 获取注解信息
        LogAnnotation logAnnotation = method.getAnnotation(LogAnnotation.class);
        String logDescription = logAnnotation != null ? logAnnotation.value() : "";
        
        // 获取请求信息（如果是Controller方法）
        String requestInfo = "";
        try {
            if (RequestContextHolder.getRequestAttributes() != null) {
                ServletRequestAttributes attributes = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
                HttpServletRequest request = attributes.getRequest();
                requestInfo = String.format(" [%s %s]", request.getMethod(), request.getRequestURI());
            }
        } catch (Exception e) {
            // 忽略获取请求信息的异常
        }
        
        // 记录方法开始日志
        System.out.println("=== 方法调用开始 ===");
        if (!logDescription.isEmpty()) {
            System.out.println("描述: " + logDescription);
        }
        System.out.println("类名: " + className);
        System.out.println("方法名: " + methodName + requestInfo);
        
        // 根据注解配置决定是否记录参数
        if (logAnnotation == null || logAnnotation.logParams()) {
            System.out.println("参数: " + Arrays.toString(joinPoint.getArgs()));
        }
        
        Object result = null;
        try {
            // 执行目标方法
            result = joinPoint.proceed();
            
            // 计算执行时间
            long endTime = System.currentTimeMillis();
            long duration = endTime - startTime;
            
            // 根据注解配置决定是否记录返回值
            if (logAnnotation == null || logAnnotation.logResult()) {
                System.out.println("返回值: " + (result != null ? result.toString() : "null"));
            }
            
            // 根据注解配置决定是否记录执行时间
            if (logAnnotation == null || logAnnotation.logTime()) {
                System.out.println("执行时间: " + duration + "ms");
            }
            
            System.out.println("=== 方法调用结束 ===");
            
            return result;
            
        } catch (Exception e) {
            // 计算执行时间
            long endTime = System.currentTimeMillis();
            long duration = endTime - startTime;
            
            // 记录异常日志
            System.out.println("异常信息: " + e.getMessage());
            if (logAnnotation == null || logAnnotation.logTime()) {
                System.out.println("执行时间: " + duration + "ms");
            }
            System.out.println("=== 方法调用异常 ===");
            
            throw e;
        }
    }
} 