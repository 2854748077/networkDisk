package org.example.networkdisk.entity.enums;

public enum VerifyRegexEnum {

    NO("","不校验"),
    EMAIL("^\\w+([-+.]\\w+)*@\\w+([-.]\\w+)*\\.\\w+([-.]\\w+)*$","邮箱"),
    Password("^[a-zA-Z0-9]{6,20}$","密码"),
   ;

    private String regex;
    private String DESC;

    VerifyRegexEnum(String regex, String desc) {
        this.regex = regex;
        this.DESC = desc;
    }

    public String getRegex() {
        return regex;
    }

    public void setRegex(String regex) {
        this.regex = regex;
    }

    public String getDESC() {
        return DESC;
    }

    public void setDESC(String DESC) {
        this.DESC = DESC;
    }
}
