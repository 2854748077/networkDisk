package com.easypan.controller;

import com.easypan.component.RedisComponent;
import com.easypan.entity.config.AppConfig;
import com.easypan.entity.constants.Constants;
import com.easypan.entity.dto.ChunkDownloadDto;
import com.easypan.entity.dto.DownloadFileDto;
import com.easypan.entity.enums.*;
import com.easypan.entity.po.FileInfo;
import com.easypan.entity.query.FileInfoQuery;
import com.easypan.entity.vo.FolderVO;
import com.easypan.entity.vo.ResponseVO;
import com.easypan.exception.BusinessException;
import com.easypan.service.FileInfoService;
import com.easypan.utils.CopyTools;
import com.easypan.utils.StringTools;
import org.apache.commons.lang3.StringUtils;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.*;

import javax.annotation.Resource;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.*;
import java.net.URLEncoder;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * 通用文件控制器基类
 * 提供文件相关的通用操作，包括文件夹信息获取、图片显示、文件下载等功能
 * 
 * @author EasyPan
 * @version 1.0
 */
@Controller
public class CommonFileController extends ABaseController {

    private static final Logger logger = LoggerFactory.getLogger(CommonFileController.class);

    /**
     * 文件信息服务
     */
    @Resource
    protected FileInfoService fileInfoService;

    /**
     * 应用配置
     */
    @Resource
    protected AppConfig appConfig;

    /**
     * Redis组件
     */
    @Resource
    private RedisComponent redisComponent;

    /**
     * 获取文件夹信息
     * 根据路径和用户ID获取文件夹的详细信息
     * 
     * @param path   文件夹路径，用"/"分隔的文件ID路径
     * @param userId 用户ID
     * @return 包含文件夹信息列表的响应对象
     */
    @GetMapping("/getFolderInfo")
    @ResponseBody
    public ResponseVO getFolderInfo(@RequestParam String path, @RequestParam String userId) {
        String[] pathArray = path.split("/");
        FileInfoQuery infoQuery = new FileInfoQuery();
        infoQuery.setUserId(userId);
        infoQuery.setFolderType(FileFolderTypeEnums.FOLDER.getType());
        infoQuery.setFileIdArray(pathArray);
        String orderBy = "field(file_id,\"" + StringUtils.join(pathArray, "\",\"") + "\")";
        infoQuery.setOrderBy(orderBy);
        List<FileInfo> fileInfoList = fileInfoService.findListByParam(infoQuery);
        return getSuccessResponseVO(CopyTools.copyList(fileInfoList, FolderVO.class));
    }

    /**
     * 获取图片文件
     * 根据图片文件夹和文件名返回图片内容，支持缓存控制
     * 
     * @param response    HTTP响应对象
     * @param imageFolder 图片所在文件夹
     * @param imageName   图片文件名
     */
    @GetMapping("/getImage/{imageFolder}/{imageName}")
    public void getImage(HttpServletResponse response,
            @PathVariable String imageFolder,
            @PathVariable String imageName) {
        if (StringTools.isEmpty(imageFolder) || StringUtils.isBlank(imageName)) {
            return;
        }
        String imageSuffix = StringTools.getFileSuffix(imageName);
        String filePath = appConfig.getProjectFolder() + Constants.FILE_FOLDER_FILE + imageFolder + "/" + imageName;
        imageSuffix = imageSuffix.replace(".", "");
        String contentType = "image/" + imageSuffix;
        response.setContentType(contentType);
        response.setHeader("Cache-Control", "max-age=2592000");
        readFile(response, filePath);
    }

    /**
     * 获取文件内容
     * 支持视频文件的.ts片段和.m3u8播放列表，以及其他类型文件的直接访问
     * 
     * @param request  HTTP请求对象
     * @param response HTTP响应对象
     * @param fileId   文件ID，可能包含.ts后缀用于视频片段
     * @param userId   用户ID
     */
    @GetMapping("/getFile/{fileId}")
    protected void getFile(HttpServletRequest request,
            HttpServletResponse response,
            @PathVariable String fileId,
            @RequestParam String userId) {
        String filePath = null;
        FileTypeEnums fileTypeEnums = null;
        // 处理视频.ts片段文件
        if (fileId.endsWith(".ts")) {
            String[] tsAarray = fileId.split("_");
            String realFileId = tsAarray[0];
            // 根据原文件的id查询出一个文件集合
            FileInfo fileInfo = fileInfoService.getFileInfoByFileIdAndUserId(realFileId, userId);
            if (fileInfo == null) {
                // 分享的视频，ts路径记录的是原视频的id,这里通过id直接取出原视频
                FileInfoQuery fileInfoQuery = new FileInfoQuery();
                fileInfoQuery.setFileId(realFileId);
                List<FileInfo> fileInfoList = fileInfoService.findListByParam(fileInfoQuery);
                fileInfo = fileInfoList.get(0);
                if (fileInfo == null) {
                    return;
                }

                // 根据当前用户id和路径去查询当前用户是否有该文件，如果没有直接返回
                fileInfoQuery = new FileInfoQuery();
                fileInfoQuery.setFilePath(fileInfo.getFilePath());
                fileInfoQuery.setUserId(userId);
                Integer count = fileInfoService.findCountByParam(fileInfoQuery);
                if (count == 0) {
                    return;
                }
            }
            String fileName = fileInfo.getFilePath();
            fileName = StringTools.getFileNameNoSuffix(fileName) + "/" + fileId;
            filePath = appConfig.getProjectFolder() + Constants.FILE_FOLDER_FILE + fileName;
        } else {
            // 处理普通文件
            FileInfo fileInfo = fileInfoService.getFileInfoByFileIdAndUserId(fileId, userId);

            fileTypeEnums = FileTypeEnums.getByType(fileInfo.getFileType());

            if (fileInfo == null || FileDelFlagEnums.DEL_REAL.getFlag().equals(fileInfo.getDelFlag())) {
                return;
            }
            // 视频文件读取.m3u8文件
            if (FileCategoryEnums.VIDEO.getCategory().equals(fileInfo.getFileCategory())) {
                // 重新设置文件路径
                String fileNameNoSuffix = StringTools.getFileNameNoSuffix(fileInfo.getFilePath());
                filePath = appConfig.getProjectFolder() + Constants.FILE_FOLDER_FILE + fileNameNoSuffix + "/"
                        + Constants.M3U8_NAME;
            } else {
                filePath = appConfig.getProjectFolder() + Constants.FILE_FOLDER_FILE + fileInfo.getFilePath();
            }
        }
        File file = new File(filePath);
        if (!file.exists()) {
            return;
        }
        // 根据文件类型选择不同的读取方式
        if (fileTypeEnums == FileTypeEnums.MUSIC) {
            readFile(request, response, filePath);
        } else {
            readFile(response, filePath);
        }

    }

    /**
     * 创建文件下载链接
     * 为指定文件生成临时下载码，用于安全下载
     * 
     * @param fileId 文件ID
     * @param userId 用户ID
     * @return 包含下载码的响应对象
     * @throws BusinessException 当文件不存在或为文件夹时抛出异常
     */

    /*
    *
    * 生成随机下载码，生成downloadFileDto对象保存下载信息数据，存储下载信息并存储到Redis中*/
    @PostMapping("/createDownloadUrl")
    @ResponseBody
    protected ResponseVO createDownloadUrl(@RequestParam String fileId, @RequestParam String userId) {
        FileInfo fileInfo = fileInfoService.getFileInfoByFileIdAndUserId(fileId, userId);
        if (fileInfo == null) {
            throw new BusinessException(ResponseCodeEnum.CODE_600);
        }
        if (FileFolderTypeEnums.FOLDER.getType().equals(fileInfo.getFolderType())) {
            throw new BusinessException(ResponseCodeEnum.CODE_600);
        }
        // 生成随机下载码
        String code = StringTools.getRandomString(Constants.LENGTH_50);
        DownloadFileDto downloadFileDto = new DownloadFileDto();
        downloadFileDto.setDownloadCode(code);
        downloadFileDto.setFilePath(fileInfo.getFilePath());
        downloadFileDto.setFileName(fileInfo.getFileName());

        // 将下载信息保存到Redis中
        redisComponent.saveDownloadCode(code, downloadFileDto);

        return getSuccessResponseVO(code);
    }

    /**
     * 分片下载
     * 根据下载码和分片索引下载文件的指定分片
     * 
     * @param request    HTTP请求对象
     * @param response   HTTP响应对象
     * @param code       下载码
     * @param chunkIndex 分片索引（从0开始）
     * @param chunkSize  分片大小（可选，默认使用系统配置）
     * @throws Exception 下载过程中可能出现的异常
     */
    @GetMapping("/downloadChunk/{code}")
    protected void downloadChunk(HttpServletRequest request,
            HttpServletResponse response,
            @PathVariable String code,
            @RequestParam Integer chunkIndex,
            @RequestParam(required = false) Integer chunkSize) throws Exception {
        // 从Redis中获取下载信息
        DownloadFileDto downloadFileDto = redisComponent.getDownloadCode(code);
        if (null == downloadFileDto) {
            response.setStatus(HttpServletResponse.SC_NOT_FOUND);
            return;
        }

        // 使用默认分片大小如果未指定
        if (chunkSize == null) {
            chunkSize = Constants.CHUNK_SIZE_DOWNLOAD;
        }

        String filePath = appConfig.getProjectFolder() + Constants.FILE_FOLDER_FILE + downloadFileDto.getFilePath();
        File file = new File(filePath);
        
        if (!file.exists()) {
            response.setStatus(HttpServletResponse.SC_NOT_FOUND);
            return;
        }

        long fileSize = file.length();
        long startByte = (long) chunkIndex * chunkSize;
        long endByte = Math.min(startByte + chunkSize - 1, fileSize - 1);

        // 验证分片索引是否有效
        if (startByte >= fileSize) {
            response.setStatus(HttpServletResponse.SC_REQUESTED_RANGE_NOT_SATISFIABLE);
            return;
        }

        // 设置响应头支持分片下载
        response.setStatus(HttpServletResponse.SC_PARTIAL_CONTENT);
        response.setContentType("application/octet-stream");
        response.setHeader("Accept-Ranges", "bytes");
        response.setHeader("Content-Range", String.format("bytes %d-%d/%d", startByte, endByte, fileSize));
        response.setContentLengthLong(endByte - startByte + 1);

        // 读取并返回指定范围的文件内容
        try (RandomAccessFile randomAccessFile = new RandomAccessFile(file, "r");
             OutputStream outputStream = response.getOutputStream()) {
            
            randomAccessFile.seek(startByte);
            byte[] buffer = new byte[8192];
            long bytesToRead = endByte - startByte + 1;
            
            while (bytesToRead > 0) {
                int bytesRead = randomAccessFile.read(buffer, 0, (int) Math.min(buffer.length, bytesToRead));
                if (bytesRead == -1) {
                    break;
                }
                outputStream.write(buffer, 0, bytesRead);
                bytesToRead -= bytesRead;
            }
            outputStream.flush();
        } catch (IOException e) {
            logger.error("分片下载失败: " + e.getMessage(), e);
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * 获取分片信息
     * 根据下载码获取文件的分片信息，包括总分片数、文件大小等元数据
     * 
     * @param code 下载码
     * @return 包含分片信息的响应对象
     */
    @GetMapping("/getChunkInfo/{code}")
    @ResponseBody
    protected ResponseVO getChunkInfo(@PathVariable String code) {
        // 从Redis中获取下载信息
        DownloadFileDto downloadFileDto = redisComponent.getDownloadCode(code);
        if (null == downloadFileDto) {
            throw new BusinessException(ResponseCodeEnum.CODE_600);
        }

        String filePath = appConfig.getProjectFolder() + Constants.FILE_FOLDER_FILE + downloadFileDto.getFilePath();
        File file = new File(filePath);
        
        if (!file.exists()) {
            throw new BusinessException(ResponseCodeEnum.CODE_600);
        }

        long fileSize = file.length();
        int chunkSize = Constants.CHUNK_SIZE_DOWNLOAD;
        int totalChunks = (int) Math.ceil((double) fileSize / chunkSize);

        // 创建分片下载信息DTO
        ChunkDownloadDto chunkDownloadDto = new ChunkDownloadDto();
        chunkDownloadDto.setDownloadCode(code);
        chunkDownloadDto.setFilePath(downloadFileDto.getFilePath());
        chunkDownloadDto.setFileName(downloadFileDto.getFileName());
        chunkDownloadDto.setFileSize(fileSize);
        chunkDownloadDto.setTotalChunks(totalChunks);
        chunkDownloadDto.setChunkSize(chunkSize);

        return getSuccessResponseVO(chunkDownloadDto);
    }

    /**
     * 文件下载
     * 根据下载码下载文件，支持不同浏览器的文件名编码处理
     * 
     * @param request  HTTP请求对象
     * @param response HTTP响应对象
     * @param code     下载码
     * @throws Exception 下载过程中可能出现的异常
     */

    /*
    * 使用 FileInputStream 读取服务器文件
        使用 HttpServletResponse.getOutputStream() 将数据发送给客户端
        客户端浏览器接收数据并保存为下载文件  *
    * */
    @GetMapping("/download/{code}")
    protected void  download(HttpServletRequest request,
            HttpServletResponse response,
            @PathVariable String code) throws Exception {
        // 从Redis中获取下载信息
        DownloadFileDto downloadFileDto = redisComponent.getDownloadCode(code);
        if (null == downloadFileDto) {
            return;
        }
        String filePath = appConfig.getProjectFolder() + Constants.FILE_FOLDER_FILE + downloadFileDto.getFilePath();
        String fileName = downloadFileDto.getFileName();
        
        // 检查文件大小，为大文件添加分片下载建议
        File file = new File(filePath);
        if (file.exists()) {
            long fileSize = file.length();
            // 如果文件大于分片大小，建议使用分片下载
            if (fileSize > Constants.CHUNK_SIZE_DOWNLOAD) {
                response.setHeader("X-Chunk-Download-Suggested", "true");
                response.setHeader("X-File-Size", String.valueOf(fileSize));
                response.setHeader("X-Chunk-Size", String.valueOf(Constants.CHUNK_SIZE_DOWNLOAD));
                response.setHeader("X-Total-Chunks", String.valueOf((int) Math.ceil((double) fileSize / Constants.CHUNK_SIZE_DOWNLOAD)));
            }
        }
        
        response.setContentType("application/x-msdownload; charset=UTF-8");

        // 根据浏览器类型处理文件名编码
        if (request.getHeader("User-Agent").toLowerCase().indexOf("msie") > 0) {
            // IE浏览器
            fileName = URLEncoder.encode(fileName, "UTF-8");
        } else {
            fileName = new String(fileName.getBytes("UTF-8"), "ISO8859-1");
        }
        response.setHeader("Content-Disposition", "attachment;filename=\"" + fileName + "\"");
        readFile(response, filePath);
    }
}


/*

### 添加的关键注释：
1. **类级别注释**：
    - `@Controller` - 将其标记为一个Spring MVC控制器。
    - 包含类描述、作者和版本的全面JavaDoc。
2. **方法级别注释**：
    - 带有适当URL映射的`@GetMapping`和`@PostMapping`。
    - 对于返回JSON响应的方法使用`@ResponseBody`。
    - 用于参数绑定的`@PathVariable`和`@RequestParam`。
    - 详细的JavaDoc注释，解释每个方法的目的、参数和返回值。
3. **字段注释**：
    - 为所有注入的依赖项添加JavaDoc注释。
    - 保留现有的用于依赖注入的`@Resource`注释。
4. **代码改进**：
    - 增强内联注释以提高代码可读性。
    - 改善间距和格式。
    - 添加适当的参数文档。

### 记录的功能：
- `getFolderInfo`：根据路径和用户ID检索文件夹信息。
- `getImage`：提供带有适当缓存头的图像文件。
- `getFile`：处理文件内容交付，包括视频流（.ts/.m3u8）。
- `createDownloadUrl`：为文件生成安全的下载代码。
- `download`：使用特定于浏览器的编码处理文件下载。

现在该控制器拥有适当的Spring MVC注释和全面的文档，使其更易于理解和维护。这些注释还通过清晰的端点映射实现了恰当的REST API功能。 

*/