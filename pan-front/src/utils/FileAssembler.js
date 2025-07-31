/**
 * 文件组装器
 * 处理分片文件的合并、完整性验证和内存优化
 */

/**
 * 文件组装器类
 */
class FileAssembler {
    /**
     * 构造函数
     * @param {string} fileName - 文件名
     * @param {number} expectedSize - 预期文件大小
     * @param {Object} options - 配置选项
     */
    constructor(fileName, expectedSize, options = {}) {
        this.fileName = fileName;
        this.expectedSize = expectedSize;
        
        // 配置参数
        this.enableIntegrityCheck = options.enableIntegrityCheck !== false; // 默认启用
        this.maxMemoryUsage = options.maxMemoryUsage || 100 * 1024 * 1024; // 100MB
        this.chunkProcessBatchSize = options.chunkProcessBatchSize || 10; // 批处理大小
        
        // 状态管理
        this.assembledSize = 0;
        this.isAssembling = false;
        this.assemblyProgress = 0;
        
        // 回调函数
        this.onProgress = options.onProgress || null;
        this.onComplete = options.onComplete || null;
        this.onError = options.onError || null;
    }
    
    /**
     * 组装文件分片
     * @param {Map<number, Blob>} chunks - 分片数据映射 (chunkIndex -> Blob)
     * @param {number} totalChunks - 总分片数
     * @returns {Promise<Blob>} 组装后的完整文件Blob
     */
    async assembleFile(chunks, totalChunks) {
        if (this.isAssembling) {
            throw new Error('File assembly is already in progress');
        }
        
        this.isAssembling = true;
        this.assembledSize = 0;
        this.assemblyProgress = 0;
        
        try {
            // 验证分片完整性
            this._validateChunks(chunks, totalChunks);
            
            // 根据内存使用情况选择组装策略
            const totalMemoryNeeded = this._estimateMemoryUsage(chunks);
            
            let assembledBlob;
            if (totalMemoryNeeded > this.maxMemoryUsage) {
                // 使用流式组装（适用于大文件）
                assembledBlob = await this._assembleWithStreaming(chunks, totalChunks);
            } else {
                // 使用标准组装（适用于小文件）
                assembledBlob = await this._assembleStandard(chunks, totalChunks);
            }
            
            // 验证最终文件大小
            if (this.enableIntegrityCheck) {
                this._validateFinalFile(assembledBlob);
            }
            
            // 触发完成回调
            if (this.onComplete) {
                this.onComplete(assembledBlob);
            }
            
            return assembledBlob;
            
        } catch (error) {
            if (this.onError) {
                this.onError(error);
            }
            throw error;
        } finally {
            this.isAssembling = false;
        }
    }
    
    /**
     * 验证分片完整性
     * @param {Map<number, Blob>} chunks - 分片数据
     * @param {number} totalChunks - 总分片数
     * @private
     */
    _validateChunks(chunks, totalChunks) {
        // 检查分片数量
        if (chunks.size !== totalChunks) {
            throw new Error(`Missing chunks: expected ${totalChunks}, got ${chunks.size}`);
        }
        
        // 检查分片索引连续性
        for (let i = 0; i < totalChunks; i++) {
            if (!chunks.has(i)) {
                throw new Error(`Missing chunk at index ${i}`);
            }
            
            const chunk = chunks.get(i);
            if (!chunk || !(chunk instanceof Blob)) {
                throw new Error(`Invalid chunk data at index ${i}`);
            }
            
            if (chunk.size === 0) {
                throw new Error(`Empty chunk at index ${i}`);
            }
        }
        
        console.log(`Chunk validation passed: ${totalChunks} chunks verified`);
    }
    
    /**
     * 估算内存使用量
     * @param {Map<number, Blob>} chunks - 分片数据
     * @returns {number} 估算的内存使用量（字节）
     * @private
     */
    _estimateMemoryUsage(chunks) {
        let totalSize = 0;
        for (const chunk of chunks.values()) {
            totalSize += chunk.size;
        }
        
        // 考虑组装过程中的额外内存开销（约2倍）
        return totalSize * 2;
    }
    
    /**
     * 标准文件组装（适用于小文件）
     * @param {Map<number, Blob>} chunks - 分片数据
     * @param {number} totalChunks - 总分片数
     * @returns {Promise<Blob>} 组装后的文件
     * @private
     */
    async _assembleStandard(chunks, totalChunks) {
        console.log('Using standard assembly method');
        
        const chunkArray = [];
        let processedChunks = 0;
        
        // 按顺序收集所有分片
        for (let i = 0; i < totalChunks; i++) {
            const chunk = chunks.get(i);
            chunkArray.push(chunk);
            
            this.assembledSize += chunk.size;
            processedChunks++;
            
            // 更新进度
            this.assemblyProgress = Math.floor((processedChunks / totalChunks) * 100);
            
            if (this.onProgress) {
                this.onProgress({
                    progress: this.assemblyProgress,
                    processedChunks: processedChunks,
                    totalChunks: totalChunks,
                    assembledSize: this.assembledSize
                });
            }
            
            // 每处理一定数量的分片后让出控制权，避免阻塞UI
            if (i % this.chunkProcessBatchSize === 0) {
                await this._yield();
            }
        }
        
        // 创建最终的Blob对象
        console.log(`Assembling ${chunkArray.length} chunks into final blob`);
        const finalBlob = new Blob(chunkArray);
        
        console.log(`Standard assembly completed: ${finalBlob.size} bytes`);
        return finalBlob;
    }
    
    /**
     * 流式文件组装（适用于大文件）
     * @param {Map<number, Blob>} chunks - 分片数据
     * @param {number} totalChunks - 总分片数
     * @returns {Promise<Blob>} 组装后的文件
     * @private
     */
    async _assembleWithStreaming(chunks, totalChunks) {
        console.log('Using streaming assembly method for large file');
        
        const batchSize = Math.min(this.chunkProcessBatchSize, 5); // 减小批处理大小
        const batches = [];
        let processedChunks = 0;
        
        // 分批处理分片
        for (let i = 0; i < totalChunks; i += batchSize) {
            const batchChunks = [];
            const batchEnd = Math.min(i + batchSize, totalChunks);
            
            // 收集当前批次的分片
            for (let j = i; j < batchEnd; j++) {
                const chunk = chunks.get(j);
                batchChunks.push(chunk);
                this.assembledSize += chunk.size;
                processedChunks++;
            }
            
            // 创建批次Blob
            const batchBlob = new Blob(batchChunks);
            batches.push(batchBlob);
            
            // 更新进度
            this.assemblyProgress = Math.floor((processedChunks / totalChunks) * 100);
            
            if (this.onProgress) {
                this.onProgress({
                    progress: this.assemblyProgress,
                    processedChunks: processedChunks,
                    totalChunks: totalChunks,
                    assembledSize: this.assembledSize,
                    currentBatch: batches.length
                });
            }
            
            // 让出控制权，避免阻塞UI
            await this._yield();
            
            console.log(`Processed batch ${batches.length}: chunks ${i}-${batchEnd-1}`);
        }
        
        // 合并所有批次
        console.log(`Merging ${batches.length} batches into final blob`);
        const finalBlob = new Blob(batches);
        
        console.log(`Streaming assembly completed: ${finalBlob.size} bytes`);
        return finalBlob;
    }
    
    /**
     * 验证最终文件
     * @param {Blob} fileBlob - 组装后的文件
     * @private
     */
    _validateFinalFile(fileBlob) {
        if (!fileBlob || !(fileBlob instanceof Blob)) {
            throw new Error('Invalid assembled file: not a Blob object');
        }
        
        if (fileBlob.size === 0) {
            throw new Error('Invalid assembled file: empty file');
        }
        
        if (this.expectedSize > 0 && fileBlob.size !== this.expectedSize) {
            throw new Error(
                `File size mismatch: expected ${this.expectedSize} bytes, got ${fileBlob.size} bytes`
            );
        }
        
        console.log(`File integrity validation passed: ${fileBlob.size} bytes`);
    }
    
    /**
     * 让出控制权给浏览器，避免阻塞UI线程
     * @returns {Promise}
     * @private
     */
    _yield() {
        return new Promise(resolve => {
            if (typeof requestIdleCallback !== 'undefined') {
                // 使用requestIdleCallback在浏览器空闲时继续
                requestIdleCallback(resolve, { timeout: 50 });
            } else {
                // 降级到setTimeout
                setTimeout(resolve, 0);
            }
        });
    }
    
    /**
     * 获取组装状态
     * @returns {Object} 状态信息
     */
    getStatus() {
        return {
            isAssembling: this.isAssembling,
            progress: this.assemblyProgress,
            assembledSize: this.assembledSize,
            expectedSize: this.expectedSize,
            fileName: this.fileName
        };
    }
    
    /**
     * 计算文件校验和（可选功能）
     * @param {Blob} fileBlob - 文件Blob对象
     * @returns {Promise<string>} SHA-256校验和
     */
    async calculateChecksum(fileBlob) {
        if (!fileBlob || !(fileBlob instanceof Blob)) {
            throw new Error('Invalid file for checksum calculation');
        }
        
        try {
            // 使用Web Crypto API计算SHA-256
            const arrayBuffer = await fileBlob.arrayBuffer();
            const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
            
            // 转换为十六进制字符串
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            
            return hashHex;
        } catch (error) {
            console.warn('Failed to calculate file checksum:', error);
            throw new Error('Checksum calculation failed: ' + error.message);
        }
    }
    
    /**
     * 验证文件校验和
     * @param {Blob} fileBlob - 文件Blob对象
     * @param {string} expectedChecksum - 预期的校验和
     * @returns {Promise<boolean>} 校验是否通过
     */
    async verifyChecksum(fileBlob, expectedChecksum) {
        if (!expectedChecksum) {
            console.warn('No expected checksum provided, skipping verification');
            return true;
        }
        
        try {
            const actualChecksum = await this.calculateChecksum(fileBlob);
            const isValid = actualChecksum.toLowerCase() === expectedChecksum.toLowerCase();
            
            if (isValid) {
                console.log('File checksum verification passed');
            } else {
                console.error(`Checksum mismatch: expected ${expectedChecksum}, got ${actualChecksum}`);
            }
            
            return isValid;
        } catch (error) {
            console.error('Checksum verification failed:', error);
            return false;
        }
    }
    
    /**
     * 执行完整的文件完整性验证
     * @param {Blob} fileBlob - 文件Blob对象
     * @param {Object} verificationOptions - 验证选项
     * @returns {Promise<Object>} 验证结果
     */
    async performIntegrityCheck(fileBlob, verificationOptions = {}) {
        const result = {
            isValid: true,
            checks: {},
            errors: [],
            warnings: []
        };
        
        try {
            // 1. 基本文件验证
            result.checks.basicValidation = this._performBasicValidation(fileBlob);
            if (!result.checks.basicValidation.isValid) {
                result.isValid = false;
                result.errors.push(...result.checks.basicValidation.errors);
            }
            
            // 2. 文件大小验证
            if (verificationOptions.expectedSize) {
                result.checks.sizeValidation = this._performSizeValidation(
                    fileBlob, 
                    verificationOptions.expectedSize
                );
                if (!result.checks.sizeValidation.isValid) {
                    result.isValid = false;
                    result.errors.push(...result.checks.sizeValidation.errors);
                }
            }
            
            // 3. 文件类型验证
            if (verificationOptions.expectedType || verificationOptions.allowedTypes) {
                result.checks.typeValidation = await this._performTypeValidation(
                    fileBlob, 
                    verificationOptions.expectedType,
                    verificationOptions.allowedTypes
                );
                if (!result.checks.typeValidation.isValid) {
                    result.isValid = false;
                    result.errors.push(...result.checks.typeValidation.errors);
                }
            }
            
            // 4. 校验和验证
            if (verificationOptions.expectedChecksum) {
                result.checks.checksumValidation = await this._performChecksumValidation(
                    fileBlob,
                    verificationOptions.expectedChecksum
                );
                if (!result.checks.checksumValidation.isValid) {
                    result.isValid = false;
                    result.errors.push(...result.checks.checksumValidation.errors);
                }
            }
            
            // 5. 文件头验证（魔数检查）
            if (verificationOptions.validateFileHeader !== false) {
                result.checks.headerValidation = await this._performHeaderValidation(fileBlob);
                if (!result.checks.headerValidation.isValid) {
                    result.warnings.push(...result.checks.headerValidation.warnings);
                }
            }
            
            // 6. 内容完整性验证
            if (verificationOptions.validateContent) {
                result.checks.contentValidation = await this._performContentValidation(
                    fileBlob,
                    verificationOptions.contentValidationOptions
                );
                if (!result.checks.contentValidation.isValid) {
                    result.isValid = false;
                    result.errors.push(...result.checks.contentValidation.errors);
                }
            }
            
        } catch (error) {
            result.isValid = false;
            result.errors.push(`Integrity check failed: ${error.message}`);
        }
        
        return result;
    }
    
    /**
     * 执行基本文件验证
     * @param {Blob} fileBlob - 文件Blob对象
     * @returns {Object} 验证结果
     * @private
     */
    _performBasicValidation(fileBlob) {
        const result = {
            isValid: true,
            errors: []
        };
        
        if (!fileBlob) {
            result.isValid = false;
            result.errors.push('File blob is null or undefined');
            return result;
        }
        
        if (!(fileBlob instanceof Blob)) {
            result.isValid = false;
            result.errors.push('Invalid file object: not a Blob instance');
            return result;
        }
        
        if (fileBlob.size === 0) {
            result.isValid = false;
            result.errors.push('File is empty (0 bytes)');
            return result;
        }
        
        return result;
    }
    
    /**
     * 执行文件大小验证
     * @param {Blob} fileBlob - 文件Blob对象
     * @param {number} expectedSize - 预期大小
     * @returns {Object} 验证结果
     * @private
     */
    _performSizeValidation(fileBlob, expectedSize) {
        const result = {
            isValid: true,
            errors: [],
            actualSize: fileBlob.size,
            expectedSize: expectedSize
        };
        
        if (fileBlob.size !== expectedSize) {
            result.isValid = false;
            result.errors.push(
                `File size mismatch: expected ${expectedSize} bytes, got ${fileBlob.size} bytes`
            );
        }
        
        return result;
    }
    
    /**
     * 执行文件类型验证
     * @param {Blob} fileBlob - 文件Blob对象
     * @param {string} expectedType - 预期类型
     * @param {Array<string>} allowedTypes - 允许的类型列表
     * @returns {Promise<Object>} 验证结果
     * @private
     */
    async _performTypeValidation(fileBlob, expectedType, allowedTypes) {
        const result = {
            isValid: true,
            errors: [],
            actualType: fileBlob.type,
            expectedType: expectedType,
            allowedTypes: allowedTypes
        };
        
        // 检查预期类型
        if (expectedType && fileBlob.type !== expectedType) {
            result.isValid = false;
            result.errors.push(
                `File type mismatch: expected ${expectedType}, got ${fileBlob.type}`
            );
        }
        
        // 检查允许的类型列表
        if (allowedTypes && Array.isArray(allowedTypes) && allowedTypes.length > 0) {
            if (!allowedTypes.includes(fileBlob.type)) {
                result.isValid = false;
                result.errors.push(
                    `File type not allowed: ${fileBlob.type}. Allowed types: ${allowedTypes.join(', ')}`
                );
            }
        }
        
        return result;
    }
    
    /**
     * 执行校验和验证
     * @param {Blob} fileBlob - 文件Blob对象
     * @param {string} expectedChecksum - 预期校验和
     * @returns {Promise<Object>} 验证结果
     * @private
     */
    async _performChecksumValidation(fileBlob, expectedChecksum) {
        const result = {
            isValid: true,
            errors: [],
            expectedChecksum: expectedChecksum,
            actualChecksum: null
        };
        
        try {
            result.actualChecksum = await this.calculateChecksum(fileBlob);
            
            if (result.actualChecksum.toLowerCase() !== expectedChecksum.toLowerCase()) {
                result.isValid = false;
                result.errors.push(
                    `Checksum mismatch: expected ${expectedChecksum}, got ${result.actualChecksum}`
                );
            }
        } catch (error) {
            result.isValid = false;
            result.errors.push(`Checksum calculation failed: ${error.message}`);
        }
        
        return result;
    }
    
    /**
     * 执行文件头验证（魔数检查）
     * @param {Blob} fileBlob - 文件Blob对象
     * @returns {Promise<Object>} 验证结果
     * @private
     */
    async _performHeaderValidation(fileBlob) {
        const result = {
            isValid: true,
            warnings: [],
            detectedType: null,
            confidence: 0
        };
        
        try {
            // 读取文件头部字节
            const headerBytes = await this._readFileHeader(fileBlob, 16);
            
            // 检测文件类型
            const detection = this._detectFileTypeFromHeader(headerBytes);
            result.detectedType = detection.type;
            result.confidence = detection.confidence;
            
            // 如果检测到的类型与声明的类型不匹配，发出警告
            if (detection.type && fileBlob.type && 
                !this._isCompatibleType(detection.type, fileBlob.type)) {
                result.warnings.push(
                    `File header suggests type ${detection.type}, but declared type is ${fileBlob.type}`
                );
            }
            
        } catch (error) {
            result.warnings.push(`File header validation failed: ${error.message}`);
        }
        
        return result;
    }
    
    /**
     * 读取文件头部字节
     * @param {Blob} fileBlob - 文件Blob对象
     * @param {number} length - 读取长度
     * @returns {Promise<Uint8Array>} 头部字节数组
     * @private
     */
    async _readFileHeader(fileBlob, length = 16) {
        const headerBlob = fileBlob.slice(0, Math.min(length, fileBlob.size));
        const arrayBuffer = await headerBlob.arrayBuffer();
        return new Uint8Array(arrayBuffer);
    }
    
    /**
     * 从文件头检测文件类型
     * @param {Uint8Array} headerBytes - 头部字节
     * @returns {Object} 检测结果
     * @private
     */
    _detectFileTypeFromHeader(headerBytes) {
        const signatures = [
            { type: 'image/jpeg', signature: [0xFF, 0xD8, 0xFF], confidence: 0.9 },
            { type: 'image/png', signature: [0x89, 0x50, 0x4E, 0x47], confidence: 0.9 },
            { type: 'image/gif', signature: [0x47, 0x49, 0x46, 0x38], confidence: 0.9 },
            { type: 'application/pdf', signature: [0x25, 0x50, 0x44, 0x46], confidence: 0.9 },
            { type: 'application/zip', signature: [0x50, 0x4B, 0x03, 0x04], confidence: 0.8 },
            { type: 'video/mp4', signature: [0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70], confidence: 0.8 },
            { type: 'audio/mpeg', signature: [0xFF, 0xFB], confidence: 0.7 },
            { type: 'text/plain', signature: [], confidence: 0.3 } // 默认文本类型
        ];
        
        for (const sig of signatures) {
            if (sig.signature.length === 0) continue; // 跳过空签名
            
            if (this._matchesSignature(headerBytes, sig.signature)) {
                return { type: sig.type, confidence: sig.confidence };
            }
        }
        
        return { type: null, confidence: 0 };
    }
    
    /**
     * 检查字节数组是否匹配签名
     * @param {Uint8Array} bytes - 字节数组
     * @param {Array<number>} signature - 签名数组
     * @returns {boolean} 是否匹配
     * @private
     */
    _matchesSignature(bytes, signature) {
        if (bytes.length < signature.length) {
            return false;
        }
        
        for (let i = 0; i < signature.length; i++) {
            if (bytes[i] !== signature[i]) {
                return false;
            }
        }
        
        return true;
    }
    
    /**
     * 检查两个MIME类型是否兼容
     * @param {string} detectedType - 检测到的类型
     * @param {string} declaredType - 声明的类型
     * @returns {boolean} 是否兼容
     * @private
     */
    _isCompatibleType(detectedType, declaredType) {
        if (detectedType === declaredType) {
            return true;
        }
        
        // 定义兼容的类型映射
        const compatibleTypes = {
            'application/zip': ['application/x-zip-compressed', 'application/x-zip'],
            'text/plain': ['text/csv', 'text/html', 'application/json'],
            'image/jpeg': ['image/jpg']
        };
        
        for (const [baseType, compatibles] of Object.entries(compatibleTypes)) {
            if (detectedType === baseType && compatibles.includes(declaredType)) {
                return true;
            }
            if (declaredType === baseType && compatibles.includes(detectedType)) {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * 执行内容完整性验证
     * @param {Blob} fileBlob - 文件Blob对象
     * @param {Object} options - 验证选项
     * @returns {Promise<Object>} 验证结果
     * @private
     */
    async _performContentValidation(fileBlob, options = {}) {
        const result = {
            isValid: true,
            errors: [],
            warnings: []
        };
        
        try {
            // 检查文件是否可读
            const isReadable = await this._testFileReadability(fileBlob);
            if (!isReadable) {
                result.isValid = false;
                result.errors.push('File content is not readable or corrupted');
                return result;
            }
            
            // 根据文件类型执行特定的内容验证
            if (options.validateStructure) {
                const structureValidation = await this._validateFileStructure(fileBlob);
                if (!structureValidation.isValid) {
                    result.errors.push(...structureValidation.errors);
                    result.warnings.push(...structureValidation.warnings);
                    result.isValid = false;
                }
            }
            
        } catch (error) {
            result.isValid = false;
            result.errors.push(`Content validation failed: ${error.message}`);
        }
        
        return result;
    }
    
    /**
     * 测试文件可读性
     * @param {Blob} fileBlob - 文件Blob对象
     * @returns {Promise<boolean>} 是否可读
     * @private
     */
    async _testFileReadability(fileBlob) {
        try {
            // 尝试读取文件的一小部分
            const testSize = Math.min(1024, fileBlob.size); // 读取最多1KB
            const testBlob = fileBlob.slice(0, testSize);
            const arrayBuffer = await testBlob.arrayBuffer();
            
            // 检查是否成功读取到数据
            return arrayBuffer && arrayBuffer.byteLength === testSize;
        } catch (error) {
            console.warn('File readability test failed:', error);
            return false;
        }
    }
    
    /**
     * 验证文件结构
     * @param {Blob} fileBlob - 文件Blob对象
     * @returns {Promise<Object>} 验证结果
     * @private
     */
    async _validateFileStructure(fileBlob) {
        const result = {
            isValid: true,
            errors: [],
            warnings: []
        };
        
        try {
            // 基于文件类型进行结构验证
            const fileType = fileBlob.type;
            
            if (fileType.startsWith('image/')) {
                // 图片文件结构验证
                const imageValidation = await this._validateImageStructure(fileBlob);
                Object.assign(result, imageValidation);
            } else if (fileType === 'application/json') {
                // JSON文件结构验证
                const jsonValidation = await this._validateJsonStructure(fileBlob);
                Object.assign(result, jsonValidation);
            } else if (fileType.startsWith('text/')) {
                // 文本文件结构验证
                const textValidation = await this._validateTextStructure(fileBlob);
                Object.assign(result, textValidation);
            }
            
        } catch (error) {
            result.isValid = false;
            result.errors.push(`Structure validation failed: ${error.message}`);
        }
        
        return result;
    }
    
    /**
     * 验证图片文件结构
     * @param {Blob} fileBlob - 文件Blob对象
     * @returns {Promise<Object>} 验证结果
     * @private
     */
    async _validateImageStructure(fileBlob) {
        const result = {
            isValid: true,
            errors: [],
            warnings: []
        };
        
        try {
            // 尝试创建Image对象来验证图片
            const imageUrl = URL.createObjectURL(fileBlob);
            
            const isValidImage = await new Promise((resolve) => {
                const img = new Image();
                
                img.onload = () => {
                    URL.revokeObjectURL(imageUrl);
                    resolve(true);
                };
                
                img.onerror = () => {
                    URL.revokeObjectURL(imageUrl);
                    resolve(false);
                };
                
                // 设置超时
                setTimeout(() => {
                    URL.revokeObjectURL(imageUrl);
                    resolve(false);
                }, 5000);
                
                img.src = imageUrl;
            });
            
            if (!isValidImage) {
                result.isValid = false;
                result.errors.push('Image file structure is invalid or corrupted');
            }
            
        } catch (error) {
            result.warnings.push(`Image structure validation failed: ${error.message}`);
        }
        
        return result;
    }
    
    /**
     * 验证JSON文件结构
     * @param {Blob} fileBlob - 文件Blob对象
     * @returns {Promise<Object>} 验证结果
     * @private
     */
    async _validateJsonStructure(fileBlob) {
        const result = {
            isValid: true,
            errors: [],
            warnings: []
        };
        
        try {
            const text = await fileBlob.text();
            JSON.parse(text);
        } catch (error) {
            result.isValid = false;
            result.errors.push(`Invalid JSON structure: ${error.message}`);
        }
        
        return result;
    }
    
    /**
     * 验证文本文件结构
     * @param {Blob} fileBlob - 文件Blob对象
     * @returns {Promise<Object>} 验证结果
     * @private
     */
    async _validateTextStructure(fileBlob) {
        const result = {
            isValid: true,
            errors: [],
            warnings: []
        };
        
        try {
            const text = await fileBlob.text();
            
            // 检查是否包含有效的文本内容
            if (text.length === 0) {
                result.warnings.push('Text file is empty');
            }
            
            // 检查是否包含二进制数据（可能表示文件损坏）
            const binaryPattern = /[\x00-\x08\x0E-\x1F\x7F-\xFF]/g;
            const binaryMatches = text.match(binaryPattern);
            
            if (binaryMatches && binaryMatches.length > text.length * 0.1) {
                result.warnings.push('Text file contains significant binary data, may be corrupted');
            }
            
        } catch (error) {
            result.isValid = false;
            result.errors.push(`Text structure validation failed: ${error.message}`);
        }
        
        return result;
    }
}

export default FileAssembler;/**
 * 文件组装工具类
 * 处理分片文件的合并、完整性验证和下载触发
 */

/**
 * 文件组装器类
 */
class FileAssembler {
    /**
     * 组装分片为完整文件
     * @param {Map<number, Blob>} chunks - 分片数据 Map<chunkIndex, Blob>
     * @param {string} fileName - 文件名
     * @param {number} totalChunks - 总分片数
     * @param {number} expectedSize - 预期文件大小（字节）
     * @returns {Promise<Blob>} 完整文件的Blob对象
     */
    static async assembleChunks(chunks, fileName, totalChunks, expectedSize) {
        try {
            // 验证输入参数
            if (!chunks || !(chunks instanceof Map)) {
                throw new Error('Invalid chunks parameter: expected Map');
            }
            
            if (!fileName || typeof fileName !== 'string') {
                throw new Error('Invalid fileName parameter: expected non-empty string');
            }
            
            if (!totalChunks || totalChunks <= 0) {
                throw new Error('Invalid totalChunks parameter: expected positive number');
            }
            
            // 检查是否所有分片都存在
            const missingChunks = [];
            for (let i = 0; i < totalChunks; i++) {
                if (!chunks.has(i)) {
                    missingChunks.push(i);
                }
            }
            
            if (missingChunks.length > 0) {
                throw new Error(`Missing chunks: ${missingChunks.join(', ')}`);
            }
            
            // 按顺序收集分片数据
            const chunkArray = [];
            let totalSize = 0;
            
            for (let i = 0; i < totalChunks; i++) {
                const chunk = chunks.get(i);
                
                // 验证分片数据
                if (!chunk || !(chunk instanceof Blob)) {
                    throw new Error(`Invalid chunk ${i}: expected Blob`);
                }
                
                if (chunk.size === 0) {
                    throw new Error(`Empty chunk ${i}: chunk size is 0`);
                }
                
                chunkArray.push(chunk);
                totalSize += chunk.size;
            }
            
            // 验证文件大小（如果提供了预期大小）
            if (expectedSize && totalSize !== expectedSize) {
                console.warn(`File size mismatch: expected ${expectedSize}, got ${totalSize}`);
                // 不抛出错误，只是警告，因为某些情况下大小可能略有差异
            }
            
            // 使用流式处理合并大文件，避免内存溢出
            if (totalSize > 100 * 1024 * 1024) { // 大于100MB使用流式处理
                return await this._assembleChunksStreaming(chunkArray, fileName);
            } else {
                // 小文件直接合并
                return await this._assembleChunksSimple(chunkArray, fileName);
            }
            
        } catch (error) {
            console.error('Failed to assemble chunks:', error);
            throw new Error(`File assembly failed: ${error.message}`);
        }
    }
    
    /**
     * 简单方式合并分片（适用于小文件）
     * @param {Array<Blob>} chunkArray - 分片数组
     * @param {string} fileName - 文件名
     * @returns {Promise<Blob>} 完整文件的Blob对象
     * @private
     */
    static async _assembleChunksSimple(chunkArray, fileName) {
        try {
            // 直接使用Blob构造函数合并
            const fileBlob = new Blob(chunkArray);
            
            // 设置文件类型
            const mimeType = this._getMimeType(fileName);
            if (mimeType) {
                return new Blob(chunkArray, { type: mimeType });
            }
            
            return fileBlob;
            
        } catch (error) {
            throw new Error(`Simple assembly failed: ${error.message}`);
        }
    }
    
    /**
     * 流式方式合并分片（适用于大文件）
     * @param {Array<Blob>} chunkArray - 分片数组
     * @param {string} fileName - 文件名
     * @returns {Promise<Blob>} 完整文件的Blob对象
     * @private
     */
    static async _assembleChunksStreaming(chunkArray, fileName) {
        try {
            // 对于大文件，分批处理以减少内存压力
            const batchSize = 10; // 每批处理10个分片
            const assembledChunks = [];
            
            for (let i = 0; i < chunkArray.length; i += batchSize) {
                const batch = chunkArray.slice(i, i + batchSize);
                const batchBlob = new Blob(batch);
                assembledChunks.push(batchBlob);
                
                // 给浏览器一些时间进行垃圾回收
                if (i % (batchSize * 5) === 0) {
                    await this._delay(10);
                }
            }
            
            // 最终合并
            const mimeType = this._getMimeType(fileName);
            const finalBlob = new Blob(assembledChunks, { type: mimeType });
            
            return finalBlob;
            
        } catch (error) {
            throw new Error(`Streaming assembly failed: ${error.message}`);
        }
    }
    
    /**
     * 验证文件完整性
     * @param {Blob} fileBlob - 文件Blob对象
     * @param {number} expectedSize - 预期文件大小
     * @param {string} expectedHash - 预期文件哈希值（可选）
     * @returns {Promise<boolean>} 验证结果
     */
    static async validateFileIntegrity(fileBlob, expectedSize, expectedHash = null) {
        try {
            // 验证文件大小
            if (expectedSize && fileBlob.size !== expectedSize) {
                console.error(`File size validation failed: expected ${expectedSize}, got ${fileBlob.size}`);
                return false;
            }
            
            // 如果提供了哈希值，进行哈希验证
            if (expectedHash) {
                const actualHash = await this._calculateFileHash(fileBlob);
                if (actualHash !== expectedHash) {
                    console.error(`File hash validation failed: expected ${expectedHash}, got ${actualHash}`);
                    return false;
                }
            }
            
            // 基本的文件头验证（检查是否为有效的文件格式）
            const isValidFormat = await this._validateFileFormat(fileBlob);
            if (!isValidFormat) {
                console.warn('File format validation failed: file may be corrupted');
                // 不返回false，因为某些文件格式可能无法识别
            }
            
            return true;
            
        } catch (error) {
            console.error('File integrity validation error:', error);
            return false;
        }
    }
    
    /**
     * 触发浏览器下载
     * @param {Blob} fileBlob - 文件Blob对象
     * @param {string} fileName - 文件名
     * @param {Object} options - 下载选项
     */
    static triggerDownload(fileBlob, fileName, options = {}) {
        try {
            // 验证输入参数
            if (!fileBlob || !(fileBlob instanceof Blob)) {
                throw new Error('Invalid fileBlob parameter: expected Blob');
            }
            
            if (!fileName || typeof fileName !== 'string') {
                throw new Error('Invalid fileName parameter: expected non-empty string');
            }
            
            // 创建下载URL
            const downloadUrl = URL.createObjectURL(fileBlob);
            
            // 创建临时下载链接
            const downloadLink = document.createElement('a');
            downloadLink.href = downloadUrl;
            downloadLink.download = fileName;
            downloadLink.style.display = 'none';
            
            // 添加到DOM并触发点击
            document.body.appendChild(downloadLink);
            downloadLink.click();
            
            // 清理资源
            setTimeout(() => {
                document.body.removeChild(downloadLink);
                URL.revokeObjectURL(downloadUrl);
            }, 100);
            
            console.log(`Download triggered for file: ${fileName} (${fileBlob.size} bytes)`);
            
        } catch (error) {
            console.error('Failed to trigger download:', error);
            throw new Error(`Download trigger failed: ${error.message}`);
        }
    }
    
    /**
     * 组装并下载文件（一站式方法）
     * @param {Map<number, Blob>} chunks - 分片数据
     * @param {string} fileName - 文件名
     * @param {number} totalChunks - 总分片数
     * @param {number} expectedSize - 预期文件大小
     * @param {Object} options - 选项
     * @returns {Promise<Blob>} 完整文件的Blob对象
     */
    static async assembleAndDownload(chunks, fileName, totalChunks, expectedSize, options = {}) {
        try {
            console.log(`Starting file assembly for: ${fileName}`);
            
            // 组装文件
            const fileBlob = await this.assembleChunks(chunks, fileName, totalChunks, expectedSize);
            
            // 验证文件完整性（如果启用）
            if (options.validateIntegrity !== false) {
                const isValid = await this.validateFileIntegrity(fileBlob, expectedSize, options.expectedHash);
                if (!isValid && options.strictValidation) {
                    throw new Error('File integrity validation failed');
                }
            }
            
            // 触发下载
            this.triggerDownload(fileBlob, fileName, options);
            
            console.log(`File assembly and download completed: ${fileName}`);
            return fileBlob;
            
        } catch (error) {
            console.error('Assembly and download failed:', error);
            throw error;
        }
    }
    
    /**
     * 根据文件名获取MIME类型
     * @param {string} fileName - 文件名
     * @returns {string|null} MIME类型
     * @private
     */
    static _getMimeType(fileName) {
        if (!fileName) return null;
        
        const extension = fileName.toLowerCase().split('.').pop();
        
        const mimeTypes = {
            // 图片
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'gif': 'image/gif',
            'bmp': 'image/bmp',
            'webp': 'image/webp',
            'svg': 'image/svg+xml',
            'ico': 'image/x-icon',
            
            // 文档
            'pdf': 'application/pdf',
            'doc': 'application/msword',
            'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'xls': 'application/vnd.ms-excel',
            'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'ppt': 'application/vnd.ms-powerpoint',
            'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'txt': 'text/plain',
            'rtf': 'application/rtf',
            
            // 音频
            'mp3': 'audio/mpeg',
            'wav': 'audio/wav',
            'ogg': 'audio/ogg',
            'aac': 'audio/aac',
            'flac': 'audio/flac',
            
            // 视频
            'mp4': 'video/mp4',
            'avi': 'video/x-msvideo',
            'mov': 'video/quicktime',
            'wmv': 'video/x-ms-wmv',
            'flv': 'video/x-flv',
            'webm': 'video/webm',
            'mkv': 'video/x-matroska',
            
            // 压缩文件
            'zip': 'application/zip',
            'rar': 'application/vnd.rar',
            '7z': 'application/x-7z-compressed',
            'tar': 'application/x-tar',
            'gz': 'application/gzip',
            
            // 代码文件
            'html': 'text/html',
            'css': 'text/css',
            'js': 'application/javascript',
            'json': 'application/json',
            'xml': 'application/xml',
            'csv': 'text/csv',
            
            // 其他
            'exe': 'application/octet-stream',
            'dmg': 'application/octet-stream',
            'iso': 'application/octet-stream'
        };
        
        return mimeTypes[extension] || null;
    }
    
    /**
     * 计算文件哈希值
     * @param {Blob} fileBlob - 文件Blob对象
     * @param {string} algorithm - 哈希算法（默认SHA-256）
     * @returns {Promise<string>} 哈希值
     * @private
     */
    static async _calculateFileHash(fileBlob, algorithm = 'SHA-256') {
        try {
            // 检查浏览器是否支持Web Crypto API
            if (!window.crypto || !window.crypto.subtle) {
                console.warn('Web Crypto API not supported, skipping hash calculation');
                return null;
            }
            
            // 读取文件数据
            const arrayBuffer = await fileBlob.arrayBuffer();
            
            // 计算哈希
            const hashBuffer = await window.crypto.subtle.digest(algorithm, arrayBuffer);
            
            // 转换为十六进制字符串
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            
            return hashHex;
            
        } catch (error) {
            console.warn('Failed to calculate file hash:', error);
            return null;
        }
    }
    
    /**
     * 验证文件格式
     * @param {Blob} fileBlob - 文件Blob对象
     * @returns {Promise<boolean>} 是否为有效格式
     * @private
     */
    static async _validateFileFormat(fileBlob) {
        try {
            // 读取文件头部字节
            const headerSize = Math.min(fileBlob.size, 16); // 读取前16字节
            const headerBlob = fileBlob.slice(0, headerSize);
            const headerBuffer = await headerBlob.arrayBuffer();
            const headerBytes = new Uint8Array(headerBuffer);
            
            // 检查常见文件格式的魔数（文件头标识）
            const fileSignatures = {
                // 图片格式
                'jpeg': [0xFF, 0xD8, 0xFF],
                'png': [0x89, 0x50, 0x4E, 0x47],
                'gif': [0x47, 0x49, 0x46, 0x38],
                'bmp': [0x42, 0x4D],
                'webp': [0x52, 0x49, 0x46, 0x46],
                
                // 文档格式
                'pdf': [0x25, 0x50, 0x44, 0x46],
                'zip': [0x50, 0x4B, 0x03, 0x04],
                'rar': [0x52, 0x61, 0x72, 0x21],
                
                // 音频格式
                'mp3': [0xFF, 0xFB],
                'wav': [0x52, 0x49, 0x46, 0x46],
                'ogg': [0x4F, 0x67, 0x67, 0x53],
                
                // 视频格式
                'mp4': [0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70],
                'avi': [0x52, 0x49, 0x46, 0x46]
            };
            
            // 检查是否匹配任何已知格式
            for (const [format, signature] of Object.entries(fileSignatures)) {
                if (this._matchesSignature(headerBytes, signature)) {
                    console.log(`File format detected: ${format}`);
                    return true;
                }
            }
            
            // 如果没有匹配到已知格式，不认为是错误
            // 因为可能是不常见的文件格式或纯文本文件
            return true;
            
        } catch (error) {
            console.warn('File format validation error:', error);
            return true; // 验证失败时不阻止下载
        }
    }
    
    /**
     * 检查字节序列是否匹配文件签名
     * @param {Uint8Array} bytes - 文件字节
     * @param {Array<number>} signature - 文件签名
     * @returns {boolean} 是否匹配
     * @private
     */
    static _matchesSignature(bytes, signature) {
        if (bytes.length < signature.length) {
            return false;
        }
        
        for (let i = 0; i < signature.length; i++) {
            if (bytes[i] !== signature[i]) {
                return false;
            }
        }
        
        return true;
    }
    
    /**
     * 延迟函数
     * @param {number} ms - 延迟毫秒数
     * @returns {Promise}
     * @private
     */
    static _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    /**
     * 清理内存中的分片数据
     * @param {Map<number, Blob>} chunks - 分片数据
     */
    static cleanupChunks(chunks) {
        try {
            if (chunks && chunks instanceof Map) {
                // 清空Map
                chunks.clear();
                
                // 建议垃圾回收（虽然不能强制执行）
                if (window.gc && typeof window.gc === 'function') {
                    window.gc();
                }
            }
        } catch (error) {
            console.warn('Failed to cleanup chunks:', error);
        }
    }
    
    /**
     * 获取内存使用情况（如果浏览器支持）
     * @returns {Object|null} 内存使用信息
     */
    static getMemoryUsage() {
        try {
            if (performance.memory) {
                return {
                    used: performance.memory.usedJSHeapSize,
                    total: performance.memory.totalJSHeapSize,
                    limit: performance.memory.jsHeapSizeLimit
                };
            }
            return null;
        } catch (error) {
            return null;
        }
    }
}

export default FileAssembler;