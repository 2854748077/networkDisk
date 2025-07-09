package org.example.networkdisk.exception;

import org.example.networkdisk.entity.vo.ResponseVo;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(BusinessException.class)
    public ResponseVo handleBusinessException(BusinessException ex) {
        return new ResponseVo("失败", ex.getMessage(), ResponseVo.FAIL);
    }

    // 可选：处理其他异常类型，如 RuntimeException、IOException 等
    @ExceptionHandler(Exception.class)
    public ResponseVo handleOtherException(Exception ex) {
        return new ResponseVo("系统错误", ex.getMessage(), ResponseVo.ERROR);
    }
}
