package com.easypan.controller;

import com.easypan.entity.enums.ResponseCodeEnum;
import com.easypan.entity.vo.ResponseVO;
import com.easypan.exception.BusinessException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import javax.servlet.http.HttpServletRequest;

@RestControllerAdvice
public class AGlobalExceptionHandlerController extends ABaseController {

    private static final Logger logger = LoggerFactory.getLogger(AGlobalExceptionHandlerController.class);

    @ExceptionHandler(Exception.class)
    public ResponseVO handleException(Exception e, HttpServletRequest request) {
        logger.error("请求错误，请求地址{},错误信息:", request.getRequestURL(), e);
        
        ResponseVO responseVO = new ResponseVO<>();
        responseVO.setStatus(STATUC_ERROR);
        
        // 为GitHub登录相关错误提供更友好的错误信息
        if (e instanceof BusinessException) {
            String errorMessage = e.getMessage();
            if (errorMessage.contains("GitHub") || errorMessage.contains("Token")) {
                responseVO.setCode(ResponseCodeEnum.CODE_500.getCode());
                responseVO.setInfo("GitHub登录失败，请稍后重试或检查网络连接");
            } else {
                responseVO.setCode(ResponseCodeEnum.CODE_600.getCode());
                responseVO.setInfo(errorMessage);
            }
        } else {
            responseVO.setCode(ResponseCodeEnum.CODE_500.getCode());
            responseVO.setInfo("系统错误，请联系管理员");
        }
        
        return responseVO;
    }
}
