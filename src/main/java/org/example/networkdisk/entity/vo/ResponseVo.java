package org.example.networkdisk.entity.vo;

public class ResponseVo {

    public static final String ERROR = "error";
    public static final String FAIL = "fail";
    private String code;
    private String message;
    private Object data;

    public ResponseVo(String number, String success, Object data) {
        this.code = number;
        this.message = success;
        this.data = data;
    }

    public static ResponseVo success(Object data) {
        return new ResponseVo("200", "success", data);
    }
    public static ResponseVo success() {
        return new ResponseVo("200", "success", null);
    }
    public static ResponseVo error(String message) {
        return new ResponseVo("500", message, null);
    }

    // Getters and Setters for JSON serialization
    public String getCode() {
        return code;
    }

    public void setCode(String code) {
        this.code = code;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public Object getData() {
        return data;
    }

    public void setData(Object data) {
        this.data = data;
    }
}
