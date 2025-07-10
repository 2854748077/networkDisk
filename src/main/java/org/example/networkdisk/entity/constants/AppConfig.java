package org.example.networkdisk.entity.constants;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component("AppConfig")
public class AppConfig {

    @Value("${spring.mail.username}")
    public String MailUserName;

    @Value("${spring.mail.password}")
    public String MailPassword;

 //   @Value("${}")

}
