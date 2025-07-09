package org.example.networkdisk.controller;

import org.example.networkdisk.entity.vo.ResponseVo;

public class BaseController {

    protected ResponseVo getSuccessResponseVO(Object data) {
        return ResponseVo.success(data);
    }
    protected ResponseVo getSuccessResponseVO() {
        return ResponseVo.success();
    }

    protected ResponseVo getErrorResponseVO(String message) {
        return ResponseVo.error(message);
    }

}
