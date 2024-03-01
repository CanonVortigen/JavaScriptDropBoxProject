class DropBoxController {

  constructor() {

    this.onselectionchange = new Event('selectionchange');
    this.currentFolder = ['HiperCloud'];
    this.navEl = document.querySelector('#browse-location');
    this.btnSendFileEl = document.querySelector("#btn-send-file");
    this.inputFilesEl = document.querySelector("#files");
    this.snackModalEl = document.querySelector("#react-snackbar-root");
    this.progressBarEl = this.snackModalEl.querySelector('.mc-progress-bar-fg')
    this.nameFileEl = this.snackModalEl.querySelector('.filename')
    this.timeleftEl = this.snackModalEl.querySelector('.timeleft')
    this.listFilesEl = document.querySelector('#list-of-files-and-directories')    
    this.btnNewFolder = document.querySelector('#btn-new-folder')
    this.btnRename = document.querySelector('#btn-rename')
    this.btnDelete = document.querySelector('#btn-delete')
    this.connDatabase();
    this.initEvents();
    this.openFolder();   

  }

  connDatabase() {
 
    const firebaseConfig = {
      /* Here you enter your firebase configuration */
    };

    // Initialize Firebase
    firebase.initializeApp(firebaseConfig);    

  }

  getSelection() {

    return this.listFilesEl.querySelectorAll('.selected');

  }

  removeFolder(ref, name) {

    return new Promise((resolve, reject) => {

      let folderRef = this.getFirebaseRef(ref + '/' + name);

      folderRef.on('value', snapshot => {

        folderRef.off('value');

        snapshot.forEach(item => {

          let data = item.val();
          data.key = item.key;

          if (data.type === 'folder') {

            this.removeFolder(ref + '/' + name, data.name).then(() => {

              resolve({
                fields: {
                  key: data.key
                }
              });

            }).catch(err => {
              reject(err);
            });

          } else if (data.type) {

            this.removeFile(ref + '/' + name, data.name).then(() => {

              resolve({
                fields: {
                  key: data.key
                }
              });

            }).catch(err => {
              reject(err);
            });

          }

        });

        folderRef.remove();       

      });

    });

  }

  removeTask() {

    let promises = [];

    this.getSelection().forEach(li=>{

      let file = JSON.parse(li.dataset.file);
      let key = li.dataset.key;

      promises.push(new Promise((resolve, reject) => {

        if (file.type === 'folder') {

          this.removeFolder(this.currentFolder.join('/'), file.name).then(()=>{

            resolve({
              fields: {
                key
              }
            });
  
          });

        } else if (file.type) {

          this.removeFile(this.currentFolder.join('/'), file.name).then(()=>{

            resolve({
              fields: {
                key
              }
            });
  
          });      

        }       

      }));

      // let formData = new FormData();
      // formData.append('path', file.path);
      // formData.append('key', key);
      //promises.push(this.ajax('/file', 'DELETE', formData));      

    });

    return Promise.all(promises);

  }

  removeFile(ref, name) {

    let fileRef = firebase.storage().ref(ref).child(name);

    return fileRef.delete();

  }

  initEvents() {

    this.btnNewFolder.addEventListener('click', e=>{

      let name = prompt('Nome da nova pasta: ');

      if (name) {

        this.getFirebaseRef().push().set({

          name,
          type: 'folder',
          path: this.currentFolder.join('/')

        });

      }

    });

    this.btnDelete.addEventListener('click', e=>{

      this.removeTask().then(responses=>{

        responses.forEach(response => {

          if (response.fields.key) {

            this.getFirebaseRef().child(response.fields.key).remove();

          }

        });

      }).catch(err => {

        console.error(err);

      });

    });

    this.btnRename.addEventListener('click', e=>{

      let li = this.getSelection()[0];
      let file = JSON.parse(li.dataset.file)
      let name = prompt("Renomear o arquivo: ", file.name);

      if (name) {

        file.name = name;

        this.getFirebaseRef().child(li.dataset.key).set(file);

      }

    });

    this.listFilesEl.addEventListener('selectionchange', e => {
      
      switch (this.getSelection().length) {

        case 0:
          this.btnDelete.style.display = 'none';
          this.btnRename.style.display = 'none';
        break;
        
        case 1:
          this.btnDelete.style.display = 'block';
          this.btnRename.style.display = 'block';
        break;

        default:
          this.btnDelete.style.display = 'block';
          this.btnRename.style.display = 'none';

      }

    });

    this.btnSendFileEl.addEventListener("click", event => {

      this.inputFilesEl.click();

    });

    this.inputFilesEl.addEventListener("change", event => {

      this.btnSendFileEl.disabled = true;     

      this.uploadTask(event.target.files).then(responses => {

        responses.forEach(resp => {

          this.getFirebaseRef().push().set({
     
            name: resp.name,
            type: resp.contentType,     
            path: resp.customMetadata.downloadURL,
            size: resp.size       

          });

        });   
        
        this.uploadComplete();

      }).catch(err => {

        this.uploadComplete();
        console.error(err);

      });  

      this.modalShow();  
      

    });

  }

  uploadComplete() {

    this.modalShow(false); 
    this.inputFilesEl.value = ""; 
    this.btnSendFileEl.disabled = false;

  }

  getFirebaseRef(path) {

    if (!path) path = this.currentFolder.join('/');

    return firebase.database().ref(path);

  }

  modalShow(show = true) {

    this.snackModalEl.style.display = (show) ? "block" : "none";

  }

  ajax(url, method = 'GET', formData = new FormData(), onprogress = function(){}, onloadstart = function(){}) {

    return new Promise((resolve, reject) => {

      let ajax = new XMLHttpRequest();  
      ajax.open(method, url);  
      ajax.onload = event => {

        try {
            resolve(JSON.parse(ajax.responseText));
        } catch (e) {
            reject(e);
        }

      }

      ajax.onerror = event => {

        reject(event);

      }

      ajax.upload.onprogress = onprogress;
      onloadstart();
      ajax.send(formData);

    });    

  }

  uploadTask(files) {

    let promises = [];

    [...files].forEach(file => {        

      promises.push(new Promise ((resolve, reject) => {

        let fileRef = firebase.storage().ref(this.currentFolder.join('/')).child(file.name);

        let task = fileRef.put(file);

        task.on('state_changed', snapshot=>{

          this.uploadProgress({
            loaded: snapshot.bytesTransferred,
            total: snapshot.totalBytes
          }, file);

        }, error => {

          console.error(error);
          reject(error);

        }, () => {

          task.snapshot.ref.getDownloadURL().then(downloadURL => {

            task.snapshot.ref.updateMetadata({ customMetadata: {downloadURL} }).then(metadata => {

              resolve(metadata);

            });

          }).catch(error => {

            console.error(error);
            reject(error);

          });

        });

      }));

    });

    return Promise.all(promises);
    
  }

  uploadProgress(event, file) {

    let timespent = Date.now() - this.startUploadTime;
    let loaded = event.loaded;
    let total = event.total;
    let porcent = parseInt((loaded / total) * 100);   
    let timeleft = ((100 - porcent) * timespent) / porcent;  
    this.progressBarEl.style.width = `${porcent}%`;  
    this.nameFileEl.innerHTML = file.name;      
    this.timeleftEl.innerHTML = this.formatTimeToHuman(timeleft); 

  }

  formatTimeToHuman(duration) {

    let seconds = parseInt((duration / 1000) % 60);
    let minutes = parseInt((duration / (1000 * 60)) % 60);
    let hours = parseInt((duration / (1000 * 60 * 60)) % 24);
   
    if (hours > 0) {
      return `${hours} horas, ${minutes} minutos e ${seconds} segundos`;
    }

    if (minutes > 0) {
      return `${minutes} minutos e ${seconds} segundos`;
    }

    if (seconds > 0) {
      return `${seconds} segundos`;
    }

    return '';

  }

  getFileIconView(file) {

    switch (file.type) {

      case 'folder':
        return `
          <svg width="160" height="160" viewBox="0 0 160 160" class="mc-icon-template-content tile__preview tile__preview--icon">
            <title>content-folder-large</title>
            <g fill="none" fill-rule="evenodd">
              <path d="M77.955 53h50.04A3.002 3.002 0 0 1 131 56.007v58.988a4.008 4.008 0 0 1-4.003 4.005H39.003A4.002 4.002 0 0 1 35 114.995V45.99c0-2.206 1.79-3.99 3.997-3.99h26.002c1.666 0 3.667 1.166 4.49 2.605l3.341 5.848s1.281 2.544 5.12 2.544l.005.003z" fill="#71B9F4"></path>
              <path d="M77.955 52h50.04A3.002 3.002 0 0 1 131 55.007v58.988a4.008 4.008 0 0 1-4.003 4.005H39.003A4.002 4.002 0 0 1 35 113.995V44.99c0-2.206 1.79-3.99 3.997-3.99h26.002c1.666 0 3.667 1.166 4.49 2.605l3.341 5.848s1.281 2.544 5.12 2.544l.005.003z" fill="#92CEFF"></path>
            </g>
          </svg>
        `;
      break;

      case 'image/jpeg':
      case 'image/jpg':
      case 'image/png':
      case 'image/gif':
        return `        
          <svg version="1.1" id="Camada_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" width="160px" height="160px" viewBox="0 0 160 160" enable-background="new 0 0 160 160" xml:space="preserve">
            <filter height="102%" width="101.4%" id="mc-content-unknown-large-a" filterUnits="objectBoundingBox" y="-.5%" x="-.7%">
              <feOffset result="shadowOffsetOuter1" in="SourceAlpha" dy="1"></feOffset>
              <feColorMatrix values="0 0 0 0 0.858823529 0 0 0 0 0.870588235 0 0 0 0 0.88627451 0 0 0 1 0" in="shadowOffsetOuter1">
              </feColorMatrix>
            </filter>
            <title>Imagem</title>
            <g>
              <g>
                <g filter="url(#mc-content-unknown-large-a)">
                  <path id="mc-content-unknown-large-b_2_" d="M47,30h66c2.209,0,4,1.791,4,4v92c0,2.209-1.791,4-4,4H47c-2.209,0-4-1.791-4-4V34
                  C43,31.791,44.791,30,47,30z"></path>
                </g>
                <g>
                  <path id="mc-content-unknown-large-b_1_" fill="#F7F9FA" d="M47,30h66c2.209,0,4,1.791,4,4v92c0,2.209-1.791,4-4,4H47
                  c-2.209,0-4-1.791-4-4V34C43,31.791,44.791,30,47,30z"></path>
                </g>
              </g>
            </g>
            <g>
              <path fill-rule="evenodd" clip-rule="evenodd" fill="#848484" d="M81.148,62.638c8.086,0,16.173-0.001,24.259,0.001
                c1.792,0,2.3,0.503,2.301,2.28c0.001,11.414,0.001,22.829,0,34.243c0,1.775-0.53,2.32-2.289,2.32
                c-16.209,0.003-32.417,0.003-48.626,0c-1.775,0-2.317-0.542-2.318-2.306c-0.002-11.414-0.003-22.829,0-34.243
                c0-1.769,0.532-2.294,2.306-2.294C64.903,62.637,73.026,62.638,81.148,62.638z M81.115,97.911c7.337,0,14.673-0.016,22.009,0.021
                c0.856,0.005,1.045-0.238,1.042-1.062c-0.028-9.877-0.03-19.754,0.002-29.63c0.003-0.9-0.257-1.114-1.134-1.112
                c-14.637,0.027-29.273,0.025-43.91,0.003c-0.801-0.001-1.09,0.141-1.086,1.033c0.036,9.913,0.036,19.826,0,29.738
                c-0.003,0.878,0.268,1.03,1.069,1.027C66.443,97.898,73.779,97.911,81.115,97.911z"></path>
              <path fill-rule="evenodd" clip-rule="evenodd" fill="#848484" d="M77.737,85.036c3.505-2.455,7.213-4.083,11.161-5.165
                c4.144-1.135,8.364-1.504,12.651-1.116c0.64,0.058,0.835,0.257,0.831,0.902c-0.024,5.191-0.024,10.381,0.001,15.572
                c0.003,0.631-0.206,0.76-0.789,0.756c-3.688-0.024-7.375-0.009-11.062-0.018c-0.33-0.001-0.67,0.106-0.918-0.33
                c-2.487-4.379-6.362-7.275-10.562-9.819C78.656,85.579,78.257,85.345,77.737,85.036z"></path>
              <path fill-rule="evenodd" clip-rule="evenodd" fill="#848484" d="M87.313,95.973c-0.538,0-0.815,0-1.094,0
                c-8.477,0-16.953-0.012-25.43,0.021c-0.794,0.003-1.01-0.176-0.998-0.988c0.051-3.396,0.026-6.795,0.017-10.193
                c-0.001-0.497-0.042-0.847,0.693-0.839c6.389,0.065,12.483,1.296,18.093,4.476C81.915,90.33,84.829,92.695,87.313,95.973z"></path>
              <path fill-rule="evenodd" clip-rule="evenodd" fill="#848484" d="M74.188,76.557c0.01,2.266-1.932,4.223-4.221,4.255
                c-2.309,0.033-4.344-1.984-4.313-4.276c0.03-2.263,2.016-4.213,4.281-4.206C72.207,72.338,74.179,74.298,74.188,76.557z"></path>
            </g>
          </svg> 
        `;
      break; 
      
      case 'application/doc':
      case 'application/docx':
        return `
          <svg width="800px" height="800px" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><defs><linearGradient id="a" x1="4.494" y1="-1712.086" x2="13.832" y2="-1695.914" gradientTransform="translate(0 1720)" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#2368c4"/><stop offset="0.5" stop-color="#1a5dbe"/><stop offset="1" stop-color="#1146ac"/></linearGradient></defs><title>file_type_word</title><path d="M28.806,3H9.705A1.192,1.192,0,0,0,8.512,4.191h0V9.5l11.069,3.25L30,9.5V4.191A1.192,1.192,0,0,0,28.806,3Z" style="fill:#41a5ee"/><path d="M30,9.5H8.512V16l11.069,1.95L30,16Z" style="fill:#2b7cd3"/><path d="M8.512,16v6.5L18.93,23.8,30,22.5V16Z" style="fill:#185abd"/><path d="M9.705,29h19.1A1.192,1.192,0,0,0,30,27.809h0V22.5H8.512v5.309A1.192,1.192,0,0,0,9.705,29Z" style="fill:#103f91"/><path d="M16.434,8.2H8.512V24.45h7.922a1.2,1.2,0,0,0,1.194-1.191V9.391A1.2,1.2,0,0,0,16.434,8.2Z" style="opacity:0.10000000149011612;isolation:isolate"/><path d="M15.783,8.85H8.512V25.1h7.271a1.2,1.2,0,0,0,1.194-1.191V10.041A1.2,1.2,0,0,0,15.783,8.85Z" style="opacity:0.20000000298023224;isolation:isolate"/><path d="M15.783,8.85H8.512V23.8h7.271a1.2,1.2,0,0,0,1.194-1.191V10.041A1.2,1.2,0,0,0,15.783,8.85Z" style="opacity:0.20000000298023224;isolation:isolate"/><path d="M15.132,8.85H8.512V23.8h6.62a1.2,1.2,0,0,0,1.194-1.191V10.041A1.2,1.2,0,0,0,15.132,8.85Z" style="opacity:0.20000000298023224;isolation:isolate"/><path d="M3.194,8.85H15.132a1.193,1.193,0,0,1,1.194,1.191V21.959a1.193,1.193,0,0,1-1.194,1.191H3.194A1.192,1.192,0,0,1,2,21.959V10.041A1.192,1.192,0,0,1,3.194,8.85Z" style="fill:url(#a)"/><path d="M6.9,17.988c.023.184.039.344.046.481h.028c.01-.13.032-.287.065-.47s.062-.338.089-.465l1.255-5.407h1.624l1.3,5.326a7.761,7.761,0,0,1,.162,1h.022a7.6,7.6,0,0,1,.135-.975l1.039-5.358h1.477l-1.824,7.748H10.591L9.354,14.742q-.054-.222-.122-.578t-.084-.52H9.127q-.021.189-.084.561c-.042.249-.075.432-.1.552L7.78,19.871H6.024L4.19,12.127h1.5l1.131,5.418A4.469,4.469,0,0,1,6.9,17.988Z" style="fill:#fff"/></svg>
        `;
      break;

      case 'application/xlx':
      case 'application/xlxs':
        return `
          <svg width="800px" height="800px" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><defs><linearGradient id="a" x1="4.494" y1="-2092.086" x2="13.832" y2="-2075.914" gradientTransform="translate(0 2100)" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#18884f"/><stop offset="0.5" stop-color="#117e43"/><stop offset="1" stop-color="#0b6631"/></linearGradient></defs><title>file_type_excel</title><path d="M19.581,15.35,8.512,13.4V27.809A1.192,1.192,0,0,0,9.705,29h19.1A1.192,1.192,0,0,0,30,27.809h0V22.5Z" style="fill:#185c37"/><path d="M19.581,3H9.705A1.192,1.192,0,0,0,8.512,4.191h0V9.5L19.581,16l5.861,1.95L30,16V9.5Z" style="fill:#21a366"/><path d="M8.512,9.5H19.581V16H8.512Z" style="fill:#107c41"/><path d="M16.434,8.2H8.512V24.45h7.922a1.2,1.2,0,0,0,1.194-1.191V9.391A1.2,1.2,0,0,0,16.434,8.2Z" style="opacity:0.10000000149011612;isolation:isolate"/><path d="M15.783,8.85H8.512V25.1h7.271a1.2,1.2,0,0,0,1.194-1.191V10.041A1.2,1.2,0,0,0,15.783,8.85Z" style="opacity:0.20000000298023224;isolation:isolate"/><path d="M15.783,8.85H8.512V23.8h7.271a1.2,1.2,0,0,0,1.194-1.191V10.041A1.2,1.2,0,0,0,15.783,8.85Z" style="opacity:0.20000000298023224;isolation:isolate"/><path d="M15.132,8.85H8.512V23.8h6.62a1.2,1.2,0,0,0,1.194-1.191V10.041A1.2,1.2,0,0,0,15.132,8.85Z" style="opacity:0.20000000298023224;isolation:isolate"/><path d="M3.194,8.85H15.132a1.193,1.193,0,0,1,1.194,1.191V21.959a1.193,1.193,0,0,1-1.194,1.191H3.194A1.192,1.192,0,0,1,2,21.959V10.041A1.192,1.192,0,0,1,3.194,8.85Z" style="fill:url(#a)"/><path d="M5.7,19.873l2.511-3.884-2.3-3.862H7.758L9.013,14.6c.116.234.2.408.238.524h.017c.082-.188.169-.369.26-.546l1.342-2.447h1.7l-2.359,3.84,2.419,3.905H10.821l-1.45-2.711A2.355,2.355,0,0,1,9.2,16.8H9.176a1.688,1.688,0,0,1-.168.351L7.515,19.873Z" style="fill:#fff"/><path d="M28.806,3H19.581V9.5H30V4.191A1.192,1.192,0,0,0,28.806,3Z" style="fill:#33c481"/><path d="M19.581,16H30v6.5H19.581Z" style="fill:#107c41"/></svg>
        `;
      break;

      case 'application/ppt':
      case 'application/pptx':
        return `
          <svg width="800px" height="800px" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><defs><linearGradient id="a" x1="4.494" y1="-1748.086" x2="13.832" y2="-1731.914" gradientTransform="translate(0 1756)" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#ca4c28"/><stop offset="0.5" stop-color="#c5401e"/><stop offset="1" stop-color="#b62f14"/></linearGradient></defs><title>file_type_powerpoint</title><path d="M18.93,17.3,16.977,3h-.146A12.9,12.9,0,0,0,3.953,15.854V16Z" style="fill:#ed6c47"/><path d="M17.123,3h-.146V16l6.511,2.6L30,16v-.146A12.9,12.9,0,0,0,17.123,3Z" style="fill:#ff8f6b"/><path d="M30,16v.143A12.905,12.905,0,0,1,17.12,29h-.287A12.907,12.907,0,0,1,3.953,16.143V16Z" style="fill:#d35230"/><path d="M17.628,9.389V23.26a1.2,1.2,0,0,1-.742,1.1,1.16,1.16,0,0,1-.45.091H7.027c-.182-.208-.358-.429-.521-.65a12.735,12.735,0,0,1-2.553-7.657v-.286A12.705,12.705,0,0,1,6.05,8.85c.143-.221.293-.442.456-.65h9.93A1.2,1.2,0,0,1,17.628,9.389Z" style="opacity:0.10000000149011612;isolation:isolate"/><path d="M16.977,10.04V23.911a1.15,1.15,0,0,1-.091.448,1.2,1.2,0,0,1-1.1.741H7.62q-.309-.314-.593-.65c-.182-.208-.358-.429-.521-.65a12.735,12.735,0,0,1-2.553-7.657v-.286A12.705,12.705,0,0,1,6.05,8.85h9.735A1.2,1.2,0,0,1,16.977,10.04Z" style="opacity:0.20000000298023224;isolation:isolate"/><path d="M16.977,10.04V22.611A1.2,1.2,0,0,1,15.785,23.8H6.506a12.735,12.735,0,0,1-2.553-7.657v-.286A12.705,12.705,0,0,1,6.05,8.85h9.735A1.2,1.2,0,0,1,16.977,10.04Z" style="opacity:0.20000000298023224;isolation:isolate"/><path d="M16.326,10.04V22.611A1.2,1.2,0,0,1,15.134,23.8H6.506a12.735,12.735,0,0,1-2.553-7.657v-.286A12.705,12.705,0,0,1,6.05,8.85h9.084A1.2,1.2,0,0,1,16.326,10.04Z" style="opacity:0.20000000298023224;isolation:isolate"/><path d="M3.194,8.85H15.132a1.193,1.193,0,0,1,1.194,1.191V21.959a1.193,1.193,0,0,1-1.194,1.191H3.194A1.192,1.192,0,0,1,2,21.959V10.041A1.192,1.192,0,0,1,3.194,8.85Z" style="fill:url(#a)"/><path d="M9.293,12.028a3.287,3.287,0,0,1,2.174.636,2.27,2.27,0,0,1,.756,1.841,2.555,2.555,0,0,1-.373,1.376,2.49,2.49,0,0,1-1.059.935A3.607,3.607,0,0,1,9.2,17.15H7.687v2.8H6.141V12.028ZM7.686,15.94H9.017a1.735,1.735,0,0,0,1.177-.351,1.3,1.3,0,0,0,.4-1.025q0-1.309-1.525-1.31H7.686V15.94Z" style="fill:#fff"/></svg>
        `;
      break;
            
      case 'application/pdf':        
        return `          
          <svg version="1.1" id="Camada_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" width="160px" height="160px" viewBox="0 0 160 160" enable-background="new 0 0 160 160" xml:space="preserve">
            <filter height="102%" width="101.4%" id="mc-content-unknown-large-a" filterUnits="objectBoundingBox" y="-.5%" x="-.7%">
              <feOffset result="shadowOffsetOuter1" in="SourceAlpha" dy="1"></feOffset>
              <feColorMatrix values="0 0 0 0 0.858823529 0 0 0 0 0.870588235 0 0 0 0 0.88627451 0 0 0 1 0" in="shadowOffsetOuter1">
              </feColorMatrix>
            </filter>
            <title>PDF</title>
            <g>
              <g>
                <g filter="url(#mc-content-unknown-large-a)">
                  <path id="mc-content-unknown-large-b_2_" d="M47,30h66c2.209,0,4,1.791,4,4v92c0,2.209-1.791,4-4,4H47c-2.209,0-4-1.791-4-4V34
                  C43,31.791,44.791,30,47,30z"></path>
                </g>
                <g>
                  <path id="mc-content-unknown-large-b_1_" fill="#F7F9FA" d="M47,30h66c2.209,0,4,1.791,4,4v92c0,2.209-1.791,4-4,4H47
                  c-2.209,0-4-1.791-4-4V34C43,31.791,44.791,30,47,30z"></path>
                </g>
              </g>
            </g>
            <path fill-rule="evenodd" clip-rule="evenodd" fill="#F15124" d="M102.482,91.479c-0.733-3.055-3.12-4.025-5.954-4.437
            c-2.08-0.302-4.735,1.019-6.154-0.883c-2.167-2.905-4.015-6.144-5.428-9.482c-1.017-2.402,1.516-4.188,2.394-6.263
            c1.943-4.595,0.738-7.984-3.519-9.021c-2.597-0.632-5.045-0.13-6.849,1.918c-2.266,2.574-1.215,5.258,0.095,7.878
            c3.563,7.127-1.046,15.324-8.885,15.826c-3.794,0.243-6.93,1.297-7.183,5.84c0.494,3.255,1.988,5.797,5.14,6.825
            c3.062,1,4.941-0.976,6.664-3.186c1.391-1.782,1.572-4.905,4.104-5.291c3.25-0.497,6.677-0.464,9.942-0.025
            c2.361,0.318,2.556,3.209,3.774,4.9c2.97,4.122,6.014,5.029,9.126,2.415C101.895,96.694,103.179,94.38,102.482,91.479z
            M67.667,94.885c-1.16-0.312-1.621-0.97-1.607-1.861c0.018-1.199,1.032-1.121,1.805-1.132c0.557-0.008,1.486-0.198,1.4,0.827
            C69.173,93.804,68.363,94.401,67.667,94.885z M82.146,65.949c1.331,0.02,1.774,0.715,1.234,1.944
            c-0.319,0.725-0.457,1.663-1.577,1.651c-1.03-0.498-1.314-1.528-1.409-2.456C80.276,65.923,81.341,65.938,82.146,65.949z
            M81.955,86.183c-0.912,0.01-2.209,0.098-1.733-1.421c0.264-0.841,0.955-2.04,1.622-2.162c1.411-0.259,1.409,1.421,2.049,2.186
            C84.057,86.456,82.837,86.174,81.955,86.183z M96.229,94.8c-1.14-0.082-1.692-1.111-1.785-2.033
            c-0.131-1.296,1.072-0.867,1.753-0.876c0.796-0.011,1.668,0.118,1.588,1.293C97.394,93.857,97.226,94.871,96.229,94.8z"></path>
          </svg> 
        `;
      break;

      case 'audio/mp3':
      case 'audio/ogg':
      case 'audio/wave':
        return `          
          <svg width="160" height="160" viewBox="0 0 160 160" class="mc-icon-template-content tile__preview tile__preview--icon">
            <title>content-audio-large</title>
            <defs>
              <rect id="mc-content-audio-large-b" x="30" y="43" width="100" height="74" rx="4"></rect>
              <filter x="-.5%" y="-.7%" width="101%" height="102.7%" filterUnits="objectBoundingBox" id="mc-content-audio-large-a">
                <feOffset dy="1" in="SourceAlpha" result="shadowOffsetOuter1"></feOffset>
                <feColorMatrix values="0 0 0 0 0.858823529 0 0 0 0 0.870588235 0 0 0 0 0.88627451 0 0 0 1 0" in="shadowOffsetOuter1"></feColorMatrix>
              </filter>
            </defs>
            <g fill="none" fill-rule="evenodd">
              <g>
                <use fill="#000" filter="url(#mc-content-audio-large-a)" xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="#mc-content-audio-large-b"></use>
                <use fill="#F7F9FA" xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="#mc-content-audio-large-b"></use>
              </g>
              <path d="M67 60c0-1.657 1.347-3 3-3 1.657 0 3 1.352 3 3v40c0 1.657-1.347 3-3 3-1.657 0-3-1.352-3-3V60zM57 78c0-1.657 1.347-3 3-3 1.657 0 3 1.349 3 3v4c0 1.657-1.347 3-3 3-1.657 0-3-1.349-3-3v-4zm40 0c0-1.657 1.347-3 3-3 1.657 0 3 1.349 3 3v4c0 1.657-1.347 3-3 3-1.657 0-3-1.349-3-3v-4zm-20-5.006A3 3 0 0 1 80 70c1.657 0 3 1.343 3 2.994v14.012A3 3 0 0 1 80 90c-1.657 0-3-1.343-3-2.994V72.994zM87 68c0-1.657 1.347-3 3-3 1.657 0 3 1.347 3 3v24c0 1.657-1.347 3-3 3-1.657 0-3-1.347-3-3V68z" fill="#637282"></path>
            </g>
          </svg>            
        `;
      break;

      case 'video/mp4':
      case 'video/quicktime':
        return `          
          <svg width="160" height="160" viewBox="0 0 160 160" class="mc-icon-template-content tile__preview tile__preview--icon">
            <title>content-video-large</title>
            <defs>
              <rect id="mc-content-video-large-b" x="30" y="43" width="100" height="74" rx="4"></rect>
              <filter x="-.5%" y="-.7%" width="101%" height="102.7%" filterUnits="objectBoundingBox" id="mc-content-video-large-a">
                <feOffset dy="1" in="SourceAlpha" result="shadowOffsetOuter1"></feOffset>
                <feColorMatrix values="0 0 0 0 0.858823529 0 0 0 0 0.870588235 0 0 0 0 0.88627451 0 0 0 1 0" in="shadowOffsetOuter1"></feColorMatrix>
              </filter>
            </defs>
            <g fill="none" fill-rule="evenodd">
              <g>
                <use fill="#000" filter="url(#mc-content-video-large-a)" xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="#mc-content-video-large-b"></use>
                <use fill="#F7F9FA" xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="#mc-content-video-large-b"></use>
              </g>
              <path d="M69 67.991c0-1.1.808-1.587 1.794-1.094l24.412 12.206c.99.495.986 1.3 0 1.794L70.794 93.103c-.99.495-1.794-.003-1.794-1.094V67.99z" fill="#637282"></path>
            </g>
          </svg>           
        `;
      break;

      default:
        return `          
          <svg width="160" height="160" viewBox="0 0 160 160" class="mc-icon-template-content tile__preview tile__preview--icon">
            <title>1357054_617b.jpg</title>
            <defs>
              <rect id="mc-content-unknown-large-b" x="43" y="30" width="74" height="100" rx="4"></rect>
              <filter x="-.7%" y="-.5%" width="101.4%" height="102%" filterUnits="objectBoundingBox" id="mc-content-unknown-large-a">
                <feOffset dy="1" in="SourceAlpha" result="shadowOffsetOuter1"></feOffset>
                <feColorMatrix values="0 0 0 0 0.858823529 0 0 0 0 0.870588235 0 0 0 0 0.88627451 0 0 0 1 0" in="shadowOffsetOuter1"></feColorMatrix>
              </filter>
            </defs>
            <g fill="none" fill-rule="evenodd">
              <g>
                <use fill="#000" filter="url(#mc-content-unknown-large-a)" xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="#mc-content-unknown-large-b"></use>
                <use fill="#F7F9FA" xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="#mc-content-unknown-large-b"></use>
              </g>
            </g>
          </svg>           
        `;

    }

  }

  getFileView(file, key) {

    let li = document.createElement('li');

    li.dataset.key = key;
    li.dataset.file = JSON.stringify(file);

    li.innerHTML = `    
      <li>
        ${this.getFileIconView(file)}
        <div class="name text-center">${file.name}</div>
      </li>      
    `;   
    this.initEventsLi(li);

    return li;

  }

  readFiles() {

    this.lastFolder = this.currentFolder.join('/');

    this.getFirebaseRef().on('value', snapshot => {

      this.listFilesEl.innerHTML = '';

      snapshot.forEach(snapshotItem => {

        let key = snapshotItem.key;
        let data = snapshotItem.val();
        
        if (data.type) {
          this.listFilesEl.appendChild(this.getFileView(data, key));
        }

      });

    });

  }

  openFolder() {

    if (this.lastFolder) this.getFirebaseRef(this.lastFolder).off('value');

    this.renderNav();

    this.readFiles();

  }

  renderNav() {

    let nav = document.createElement('nav');
    let path = [];

    for (let i = 0; i < this.currentFolder.length; i++) {

      let folderName = this.currentFolder[i];
      let span = document.createElement('span');

      path.push(folderName);

      if ((i + 1) === this.currentFolder.length) {

        span.innerHTML = folderName;

      } else {

        span.classList = 'breadcrumb-segment__wrapper';
        span.innerHTML = `         
          <span class="ue-effect-container uee-BreadCrumbSegment-link-0">
            <a href="#" data-path="${path.join('/')}" class="breadcrumb-segment">${folderName}</a>
          </span>
          <svg width="24" height="24" viewBox="0 0 24 24" class="mc-icon-template-stateless" style="top: 4px; position: relative;">
            <title>arrow-right</title>
            <path d="M10.414 7.05l4.95 4.95-4.95 4.95L9 15.534 12.536 12 9 8.464z" fill="#637282" fill-rule="evenodd"></path>
          </svg>         
        `;

      }

      nav.appendChild(span);

    }

    this.navEl.innerHTML = nav.innerHTML;

    this.navEl.querySelectorAll('a').forEach(a=>{

      a.addEventListener('click', e=>{

        e.preventDefault();

        this.currentFolder = a.dataset.path.split('/');

        this.openFolder();

      });

    });

  }

  initEventsLi(li) {

    li.addEventListener('dblclick', e=>{

      let file = JSON.parse(li.dataset.file);

      switch (file.type) {

        case 'folder':
          this.currentFolder.push(file.name);
          this.openFolder();
        break;

        default:
          //window.open('/file?path=' + file.path);
          window.open(file.path);

      }

    });

    li.addEventListener('click', e => { 

      if (e.shiftKey) {

        let firstLi = this.listFilesEl.querySelector('.selected');

        if (firstLi) {

          let indexStart;
          let indexEnd;
          let lis = li.parentElement.childNodes;

          lis.forEach((el, index) => {

            if (firstLi === el) indexStart = index;
            if (li === el) indexEnd = index;

          });

          let index = [indexStart, indexEnd].sort();

          lis.forEach((el, i) => {

              if (i >= index[0] && i<= index[1]) {

                el.classList.add('selected');

              }
          
          });

          this.listFilesEl.dispatchEvent(this.onselectionchange);

          return true;

        }

      }

      if (!e.ctrlKey) {

        this.listFilesEl.querySelectorAll('li.selected').forEach(el => {

          el.classList.remove('selected');

        });

      }

      li.classList.toggle('selected');

      this.listFilesEl.dispatchEvent(this.onselectionchange);

    });

  }
  
}












// Saving the datas in the machine local 

/*uploadTask(files) {

  let promises = [];

    [...files].forEach(file => {

      let formData = new FormData();

      formData.append('input-file', file);       

      promises.push(this.ajax('/upload', 'POST', formData, (event) => {

        this.uploadProgress(event, file);

      }, () => {

        this.startUploadTime = Date.now(); 

      }));

    });

  return Promise.all(promises)
  
}*/







