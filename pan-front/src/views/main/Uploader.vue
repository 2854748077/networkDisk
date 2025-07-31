<template>
  <div class="uploader-panel">
    <div class="uploader-title">
      <span>上传任务</span>
      <span class="tips">（仅展示本次上传任务）</span>
    </div>
    <div class="file-list">
      <div v-for="(item, index) in fileList" class="file-item">
        <div class="upload-panel">
          <div class="file-name">
            {{ item.fileName }}
          </div>
          <div class="progress">
            <!--上传-->
            <el-progress :percentage="item.uploadProgress" v-if="
              item.status == STATUS.uploading.value ||
              item.status == STATUS.upload_seconds.value ||
              item.status == STATUS.upload_finish.value
            " />
          </div>
          <div class="upload-status">
            <!--图标-->
            <span :class="['iconfont', 'icon-' + STATUS[item.status].icon]"
              :style="{ color: STATUS[item.status].color }"></span>
            <!--状态描述-->
            <span class="status" :style="{ color: STATUS[item.status].color }">{{
              item.status == "fail" ? item.errorMsg : STATUS[item.status].desc
            }}</span>
            <!--上传中-->
            <span class="upload-info" v-if="item.status == STATUS.uploading.value">
              {{ proxy.Utils.size2Str(item.uploadSize) }}/{{
                proxy.Utils.size2Str(item.totalSize)
              }}
            </span>
          </div>
        </div>
        <div class="op">
          <!--MD5-->
          <el-progress type="circle" :width="50" :percentage="item.md5Progress"
            v-if="item.status == STATUS.init.value" />
          <div class="op-btn">
            <span v-if="item.status === STATUS.uploading.value">
              <icon :width="28" class="btn-item" iconName="upload" v-if="item.pause" title="上传"
                @click="startUpload(item.uid)"></icon>
              <icon :width="28" class="btn-item" iconName="pause" title="暂停" @click="pauseUpload(item.uid)" v-else>
              </icon>
            </span>
            <icon :width="28" class="del btn-item" iconName="del" title="删除" v-if="
              item.status != STATUS.init.value &&
              item.status != STATUS.upload_finish.value &&
              item.status != STATUS.upload_seconds.value
            " @click="delUpload(item.uid, index)"></icon>
            <icon :width="28" class="clean btn-item" iconName="clean" title="清除" v-if="
              item.status == STATUS.upload_finish.value ||
              item.status == STATUS.upload_seconds.value
            " @click="delUpload(item.uid, index)"></icon>
          </div>
        </div>
      </div>
      <div v-if="fileList.length == 0">
        <NoData msg="暂无上传任务"></NoData>
      </div>
    </div>
  </div>
</template>

<script setup>
import {
  getCurrentInstance,
  onMounted,
  reactive,
  ref,
  watch,
  nextTick,
} from "vue";
import SparkMD5 from "spark-md5";
const { proxy } = getCurrentInstance();

const api = {
  upload: "/file/uploadFile",
};

const STATUS = {
  emptyfile: {
    value: "emptyfile",
    desc: "文件为空",
    color: "#F75000",
    icon: "close",
  },
  fail: {
    value: "fail",
    desc: "上传失败",
    color: "#F75000",
    icon: "close",
  },
  init: {
    value: "init",
    desc: "解析中",
    color: "#e6a23c",
    icon: "clock",
  },
  uploading: {
    value: "uploading",
    desc: "上传中",
    color: "#409eff",
    icon: "upload",
  },
  upload_finish: {
    value: "upload_finish",
    desc: "上传完成",
    color: "#67c23a",
    icon: "ok",
  },
  upload_seconds: {
    value: "upload_seconds",
    desc: "秒传",
    color: "#67c23a",
    icon: "ok",
  },
};

const chunkSize = 1024 * 512;
const fileList = ref([]);
const delList = ref([]);

//添加文件上传文件
const addFile = async (file, filePid) => {
  const fileItem = {
    file: file,
    //文件UID
    uid: file.uid,
    //md5进度
    md5Progress: 0,
    //md5值
    md5: null,
    //文件名
    fileName: file.name,
    //上传状态
    status: STATUS.init.value,
    //已上传大小
    uploadSize: 0,
    //文件总大小
    totalSize: file.size,
    //进度
    uploadProgress: 0,
    //暂停
    pause: false,
    //当前分片
    chunkIndex: 0,
    //父级ID
    filePid: filePid,
    //错误信息
    errorMsg: null,
  };
  //加入文件
  fileList.value.unshift(fileItem);  //unshift（）：列表开头添加元素
  if (fileItem.totalSize == 0) {
    fileItem.status = STATUS.emptyfile.value;
    return;
  }
  //计算文件MD5值
  let md5FileUid = await computeMD5(fileItem);
  if (md5FileUid == null) {
    return;
  }
  uploadFile(md5FileUid);
};
defineExpose({ addFile });

/**
 * 
 *断点续传：通过设置pause标志，来判断开始或停止
 */
//开始继续上传
const startUpload = (uid) => {
  let currentFile = getFileByUid(uid);
  currentFile.pause = false;          
  uploadFile(uid, currentFile.chunkIndex);
};
//暂停上传
const pauseUpload = (uid) => {
  let currentFile = getFileByUid(uid);
  currentFile.pause = true;            //设置暂停标志
};
//删除文件
const delUpload = (uid, index) => {
  delList.value.push(uid);
  fileList.value.splice(index, 1);
};

/**
 * 
 * 分片上传：获取当前分片索引，通过UID获取当前文件，获取文件大小，计算分片数量。
 * 通过for循环逐个分片上传，（先判断是否删除或暂停），计算分片起始和结束位置，
 * file.slice（）方法获取分片数据，上传分片（包含MD5，分片数，和当前分片索引），实时更新上传进度以及文件大小
 * 更新文件状态，检查是否上传完成或者秒传。（重新加载当前路由视图，更新用户存储空间信息）
 * 
 */
const emit = defineEmits(["uploadCallback"]);
const uploadFile = async (uid, chunkIndex) => {

  chunkIndex = chunkIndex ? chunkIndex : 0;
  let currentFile = getFileByUid(uid);
  const file = currentFile.file;
  const fileSize = currentFile.totalSize;
  const chunks = Math.ceil(fileSize / chunkSize);

  //逐个分片上传
  for (let i = chunkIndex; i < chunks; i++) {
    //检查是否被删除
    let delIndex = delList.value.indexOf(uid);
    if (delIndex != -1) {
      delList.value.splice(delIndex, 1);
      break;
    }
    currentFile = getFileByUid(uid);
    //检查是否被暂停，暂停就跳出循环
    if (currentFile.pause) {
      break;
    }
    // 计算当前分片的起始和结束位置
    let start = i * chunkSize;
    let end = start + chunkSize >= fileSize ? fileSize : start + chunkSize;
    let chunkFile = file.slice(start, end);  //一个新的 Blob 对象，包含指定范围的数据
    // 上传当前分片
    let uploadResult = await proxy.Request({
      url: api.upload,
      showLoading: false,
      dataType: "file",
      params: {
        file: chunkFile,
        fileName: file.name,
        fileMd5: currentFile.md5,    //这是整个文件的MD5，不是分片的MD5
        chunkIndex: i,               //分片的索引
        chunks: chunks,              //总分片数量
        fileId: currentFile.fileId,
        filePid: currentFile.filePid,
      },
      showError: false,
      errorCallback: (errorMsg) => {
        currentFile.status = STATUS.fail.value;
        currentFile.errorMsg = errorMsg;
      },
      //实时更新上传进度
      uploadProgressCallback: (event) => {
        let loaded = event.loaded;     //已上传字节数
        if (loaded > fileSize) {
          loaded = fileSize;
        }
        //更新文件大小和上传进度%
        currentFile.uploadSize = i * chunkSize + loaded;
        currentFile.uploadProgress = Math.floor(
          (currentFile.uploadSize / fileSize) * 100
        );
      },
    });
    if (uploadResult == null) {
      break;
    }
    //更新文件状态
    currentFile.fileId = uploadResult.data.fileId;
    currentFile.status = STATUS[uploadResult.data.status].value;
    currentFile.chunkIndex = i;
      // 检查是否完成（秒传或正常完成）
    if (
      uploadResult.data.status == STATUS.upload_seconds.value ||
      uploadResult.data.status == STATUS.upload_finish.value
    ) {
      currentFile.uploadProgress = 100;
      emit("uploadCallback");     //通知父组件
      break;
    }
  }
};
/*
计算MD5值
fileItem获取file，然后获取切片方法，计算总共多少个分片，，设置当前分片为0；
创建sparkMD5，增量计算MD5，创建fileRead，然后定义和执行loadNext（计算开始和结束的文件大小，然后读取对应片段文件）
读取成功出发onload（）将当前分片数据添加到MD5计算器中，当前分片数+1，通过通过分片数判断是否上传完成，
未完成继续执行loadNext（）
分片md5计算：每次处理512k，不怕内存不足，页面崩溃

*/
const computeMD5 = (fileItem) => {
  let file = fileItem.file;
   // 获取文件切片方法，兼容不同浏览器
  let blobSlice =
    File.prototype.slice ||         //  标准方法
    File.prototype.mozSlice ||          // Firefox浏览器
    File.prototype.webkitSlice;        // Webkit内核浏览器

    //计算文件要分多少块
  let chunks = Math.ceil(file.size / chunkSize);   // chunkSize = 1024 * 512 = 512KB
  let currentChunk = 0;
  //创建sparkMD5用于增量计算MD5
  let spark = new SparkMD5.ArrayBuffer();
  let fileReader = new FileReader();
  let time = new Date().getTime();

  let loadNext = () => {
    let start = currentChunk * chunkSize;
    let end = start + chunkSize >= file.size ? file.size : start + chunkSize;
    //读取指定范围的文件数据为ArrayBuffer格式
    fileReader.readAsArrayBuffer(blobSlice.call(file, start, end));
  };

  loadNext();

  return new Promise((resolve, reject) => {
    let resultFile = getFileByUid(file.uid);
    //onload出发后的回调函数（FiledReader内置事件）
    fileReader.onload = (e) => {
        // 将读取到的分片数据追加到MD5计算器中
      spark.append(e.target.result);  //	添加一块 ArrayBuffer 数据
      currentChunk++;

      if (currentChunk < chunks) {
         // 更新MD5计算进度
        let percent = Math.floor((currentChunk / chunks) * 100);
        resultFile.md5Progress = percent;
        loadNext();  //下一个分片
      } else {
        // 所有分片处理完成，生成最终的MD5值
        let md5 = spark.end();     //完成计算，返回最终的 MD5 字符串
        spark.destroy();          //释放内存
        resultFile.md5Progress = 100;
        resultFile.status = STATUS.uploading.value;//更新状态为上传中
        resultFile.md5 = md5;       
        resolve(fileItem.uid);      //返回文件UID
      }
    };

    fileReader.onerror = () => {
      resultFile.md5Progress = -1;
      resultFile.status = STATUS.fail.value;
      resolve(fileItem.uid);
    };
  }).catch((error) => {
    return null;
  });
};

//获取文件
const getFileByUid = (uid) => {
  let file = fileList.value.find((item) => {
    return item.file.uid === uid;
  });
  return file;
};
</script>

<style lang="scss" scoped>
.uploader-panel {
  .uploader-title {
    border-bottom: 1px solid #ddd;
    line-height: 40px;
    padding: 0px 10px;
    font-size: 15px;

    .tips {
      font-size: 13px;
      color: rgb(169, 169, 169);
    }
  }

  .file-list {
    overflow: auto;
    padding: 10px 0px;
    min-height: calc(100vh / 2);
    max-height: calc(100vh - 120px);

    .file-item {
      position: relative;
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 3px 10px;
      background-color: #fff;
      border-bottom: 1px solid #ddd;
    }

    .file-item:nth-child(even) {
      background-color: #fcf8f4;
    }

    .upload-panel {
      flex: 1;

      .file-name {
        color: rgb(64, 62, 62);
      }

      .upload-status {
        display: flex;
        align-items: center;
        margin-top: 5px;

        .iconfont {
          margin-right: 3px;
        }

        .status {
          color: red;
          font-size: 13px;
        }

        .upload-info {
          margin-left: 5px;
          font-size: 12px;
          color: rgb(112, 111, 111);
        }
      }

      .progress {
        height: 10px;
      }
    }

    .op {
      width: 100px;
      display: flex;
      align-items: center;
      justify-content: flex-end;

      .op-btn {
        .btn-item {
          cursor: pointer;
        }

        .del,
        .clean {
          margin-left: 5px;
        }
      }
    }
  }
}
</style>
