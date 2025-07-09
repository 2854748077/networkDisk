# AOP日志使用说明

## 概述

本项目集成了AOP（面向切面编程）日志功能，可以自动记录方法调用、参数、返回值、执行时间等信息，帮助开发者进行调试和性能监控。

## 功能特性

- ✅ 自动记录方法调用信息
- ✅ 记录方法参数和返回值
- ✅ 计算方法执行时间
- ✅ 支持自定义注解控制日志行为
- ✅ 支持JSON格式日志输出
- ✅ 记录HTTP请求信息（IP、User-Agent等）
- ✅ 异常信息记录
- ✅ 可配置的日志行为

## 文件结构

```
src/main/java/org/example/networkdisk/
├── aspect/
│   ├── LogAspect.java          # 基础日志切面
│   └── JsonLogAspect.java      # JSON格式日志切面
├── annotation/
│   └── LogAnnotation.java      # 自定义日志注解
└── config/
    └── LogConfig.java          # 日志配置类
```

## 使用方法

### 1. 自动日志记录

所有Controller和Service方法都会自动记录日志，无需额外配置。

### 2. 使用自定义注解

在需要特殊日志记录的方法上添加`@LogAnnotation`注解：

```java
@RestController
public class MyController {
    
    @RequestMapping("/test")
    @LogAnnotation("测试方法")
    public String test(String param) {
        return "Hello " + param;
    }
    
    @RequestMapping("/test2")
    @LogAnnotation(value = "测试方法2", logParams = false, logResult = false)
    public void test2() {
        // 只记录执行时间，不记录参数和返回值
    }
}
```

### 3. 注解参数说明

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| value | String | "" | 日志描述 |
| logParams | boolean | true | 是否记录参数 |
| logResult | boolean | true | 是否记录返回值 |
| logTime | boolean | true | 是否记录执行时间 |

## 配置选项

在`application.properties`中配置日志行为：

```properties
# AOP日志配置
app.log.enabled=true              # 是否启用AOP日志
app.log.log-params=true           # 是否记录参数
app.log.log-result=true           # 是否记录返回值
app.log.log-time=true             # 是否记录执行时间
app.log.use-json=false            # 是否使用JSON格式
app.log.level=INFO                # 日志级别
```

## 日志输出示例

### 普通格式日志

```
=== 方法调用开始 ===
描述: 发送邮件验证码
类名: accountController
方法名: sendEmailCode [POST /api/sendEmailCode]
参数: [test@example.com, 1234, 1, org.apache.catalina.session.StandardSessionFacade@123456]
返回值: ResponseVo{code='200', message='success', data=null}
执行时间: 150ms
=== 方法调用结束 ===
```

### JSON格式日志

```json
{
  "type": "METHOD_START",
  "timestamp": 1640995200000,
  "description": "发送邮件验证码",
  "className": "accountController",
  "methodName": "sendEmailCode",
  "requestInfo": {
    "method": "POST",
    "uri": "/api/sendEmailCode",
    "ip": "127.0.0.1",
    "userAgent": "Mozilla/5.0..."
  },
  "parameters": ["test@example.com", "1234", 1, "session"]
}
```

## 性能考虑

1. **生产环境建议**：
   - 设置`app.log.enabled=false`关闭AOP日志
   - 或设置`app.log.log-params=false`减少参数记录
   - 使用`@LogAnnotation(logParams=false)`选择性记录

2. **敏感信息处理**：
   - 避免记录密码、token等敏感信息
   - 使用`logParams=false`跳过参数记录

3. **日志文件管理**：
   - 定期清理日志文件
   - 配置日志轮转策略

## 扩展功能

### 1. 添加新的日志切面

```java
@Aspect
@Component
public class CustomLogAspect {
    
    @Pointcut("@annotation(org.example.networkdisk.annotation.LogAnnotation)")
    public void customLog() {}
    
    @Around("customLog()")
    public Object around(ProceedingJoinPoint joinPoint) throws Throwable {
        // 自定义日志逻辑
    }
}
```

### 2. 自定义日志格式

可以修改`LogAspect`或`JsonLogAspect`来自定义日志格式。

### 3. 集成日志框架

可以将日志输出重定向到Log4j、Logback等日志框架。

## 注意事项

1. **循环调用**：避免在日志切面中调用被切面监控的方法，防止无限递归
2. **异常处理**：日志切面中的异常不应影响正常业务逻辑
3. **性能影响**：AOP日志会带来一定的性能开销，生产环境需要谨慎使用
4. **内存使用**：大量日志输出可能影响内存使用，需要合理配置

## 故障排除

### 1. 日志不输出
- 检查`app.log.enabled`配置
- 确认方法在切点范围内
- 检查是否有异常被捕获

### 2. 参数序列化失败
- 检查参数对象是否可序列化
- 使用`logParams=false`跳过参数记录

### 3. 性能问题
- 减少日志记录内容
- 使用异步日志记录
- 关闭不必要的日志功能 