/**
 * 文件分类信息配置
 * 定义不同文件类型对应的文件扩展名，用于文件上传和分类显示
 */

export default {
    // 全部文件类型
    "all": {
        accept: "*" // 接受所有文件类型
    },
    
    // 视频文件类型
    "video": {
        accept: ".mp4,.avi,.rmvb,.mkv,.mov" // 常见视频格式
    },
    
    // 音乐文件类型
    "music": {
        accept: ".mp3,.wav,.wma,.mp2,.flac,.midi,.ra,.ape,.aac,.cda" // 常见音频格式
    },
    
    // 图片文件类型
    "image": {
        accept: ".jpeg,.jpg,.png,.gif,.bmp,.dds,.psd,.pdt,.webp,.xmp,.svg,.tiff" // 常见图片格式
    },
    
    // 文档文件类型
    "doc": {
        accept: ".pdf,.doc,.docx,.xls,.xlsx,.txt" // 常见文档格式
    },
    
    // 其他文件类型
    "others": {
        accept: "*" // 接受所有文件类型
    },
}