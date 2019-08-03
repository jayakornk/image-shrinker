const { ipcRenderer, shell } = require('electron');
const settings = require('electron-settings');
const { dialog } = require('electron').remote;
const fs = require('fs');
const path = require('path');
const log = require('electron-log');

let dragzone = document.getElementById('dragzone'),
    resultBox = document.getElementById('result'),
    btnOpenSettings = document.getElementById('btnOpenSettings'),
    btnCloseSettings = document.getElementById('btnCloseSettings'),
    menuSettings = document.getElementById('menuSettings'),
    switches = document.getElementsByTagName('input'),
    openInBrowserLink = document.getElementsByClassName('openInBrowser'),
    btnSavepath = document.getElementById('btnSavepath'),
    wrapperSavePath = document.getElementById('wrapperSavePath'),
    folderswitch = document.getElementById('folderswitch'),
    clearlist = document.getElementById('clearlist'),
    updatecheck = document.getElementById('updatecheck'),
    addxmltag = document.getElementById('addxmltag'),
    prettifysvg = document.getElementById('prettifysvg'),
    jpegquality = document.getElementById('jpegquality'),
    jpegprogressive = document.getElementById('jpegprogressive'),
    notification = document.getElementById('notification');

/*
 * Settings
 */
let userSetting = settings.getAll();
notification.checked = userSetting.notification;
clearlist.checked = userSetting.clearlist;
updatecheck.checked = userSetting.updatecheck;
addxmltag.checked = userSetting.addxmltag;
prettifysvg.checked = userSetting.prettifysvg;
jpegquality.valueAsNumber = userSetting.jpegquality;
jpegprogressive.checked = userSetting.jpegprogressive;

if (userSetting.folderswitch === false) {
    folderswitch.checked = false;
    wrapperSavePath.classList.remove('d-none');
} else {
    folderswitch.checked = true;
}

/**
 * @param {{savepath:string}} userSetting
 */
if (userSetting.savepath)
    btnSavepath.innerText = cutFolderName(userSetting.savepath[0]);

/*
 * Open filepicker
 */
dragzone.onclick = () => {
    dialog.showOpenDialog(
        {
            properties: ['openFile', 'multiSelections']
        },
        item => {
            if (!item) {
                return;
            }

            if (settings.get('clearlist') === true) {
                resultBox.innerHTML = '';
            }

            for (let f of item) {
                let filename = path.parse(f).base;
                ipcRenderer.send('shrinkImage', filename, f);
            }

            // Add loader
            dragzone.classList.add('is--processing');
        }
    );
};

document.ondragover = () => {
    dragzone.classList.add('drag-active');
    return false;
};

document.ondragleave = () => {
    dragzone.classList.remove('drag-active');
    return false;
};

document.ondragend = () => {
    dragzone.classList.remove('drag-active');
    return false;
};

/*
 * Action on drag drop
 */
document.ondrop = e => {
    e.preventDefault();

    var items = e.dataTransfer.items;
    for (var i=0; i<items.length; i++) {
        // webkitGetAsEntry is where the magic happens
        var item = items[i].webkitGetAsEntry();
        if (item) {
            traverseFileTree(item);
        }
    }

    if (settings.get('clearlist')) {
        resultBox.innerHTML = '';
    }

    dragzone.classList.add('is--processing');
    dragzone.classList.remove('drag-active');

    return false;
};

/*
 * Choose folder for saving shrinked images
 */
btnSavepath.onclick = () => {
    dialog.showOpenDialog(
        {
            properties: ['openDirectory', 'createDirectory']
        },
        path => {
            if (typeof path !== 'undefined') {
                btnSavepath.innerText = cutFolderName(path[0]);
                settings.set('savepath', path);
            }
        }
    );
};

/*
 * Save settings
 */
Array.from(switches).forEach(switchEl => {
    switchEl.onchange = e => {
        if (e.target.type === 'number') {
            settings.set(e.target.name, e.target.valueAsNumber);
        } else {
            settings.set(e.target.name, e.target.checked);
        }
        if (e.target.name === 'folderswitch') {
            if (e.target.checked === false) {
                wrapperSavePath.classList.remove('d-none');
            } else {
                wrapperSavePath.classList.add('d-none');
            }
        }
    };
});

/*
 * Settings menu
 */
// Open
btnOpenSettings.onclick = e => {
    e.preventDefault();
    menuSettings.classList.add('is--open');
};

// Close on pressing close icon
btnCloseSettings.onclick = e => {
    e.preventDefault();
    menuSettings.classList.remove('is--open');
};

// Close on pressing ESC
document.onkeyup = e => {
    if (e.key === 27) {
        menuSettings.classList.remove('is--open');
    }
};

/*
 * Renderer process
 */
ipcRenderer
    .on('isShrinked', (event, path, sizeBefore, sizeAfter) => {
        let percent = Math.round((100 / sizeBefore) * (sizeBefore - sizeAfter));

        // Remove loader
        dragzone.classList.remove('is--processing');

        // Create container
        let resContainer = document.createElement('div');
        resContainer.className = 'resLine';
        resContainer.innerHTML =
      '<span>You saved ' +
      percent +
      '%. Your shrinked image is here:</span><br>';

        // Create link
        let resElement = document.createElement('a');
        resElement.setAttribute('href', '#');
        let resText = document.createTextNode(path);
        resElement.appendChild(resText);

        // Add click event
        resElement.onclick = el => {
            el.preventDefault();
            shell.showItemInFolder(path);
        };

        resContainer.appendChild(resElement);
        resultBox.prepend(resContainer);

        // Notification
        if (settings.get('notification')) {
            new window.Notification('Image shrinked, pal!', {
                body: path,
                silent: true
            });
        }
    })
    .on('openSettings', () => {
        menuSettings.classList.add('is--open');
    })
    .on('error', () => {
    // Remove loader
        dragzone.classList.remove('is--processing');
    });

/*
 * Parallax background
 */
let bg = document.getElementById('background'),
    winX = window.innerWidth / 2,
    winY = window.innerHeight / 2;

// Fix window size on resize
window.onresize = () => {
    setTimeout(() => {
        winX = window.innerWidth / 2;
        winY = window.innerHeight / 2;
    }, 700);
};

// Let's do some parallax stuff
document.onmousemove = e => {
    let transX = e.clientX - winX,
        transY = e.clientY - winY,
        tiltX = transX / winY,
        tiltY = -(transY / winX),
        radius = Math.sqrt(Math.pow(tiltX, 2) + Math.pow(tiltY, 2)),
        transformX = Math.floor(tiltX * Math.PI),
        transformY = Math.floor(tiltY * Math.PI),
        degree = radius * 15,
        transform;

    transform = 'scale(1.15)';
    transform += ' rotate3d(' + tiltX + ', ' + tiltY + ', 0, ' + degree + 'deg)';
    transform += ' translate3d(' + transformX + 'px, ' + transformY + 'px, 0)';

    bg.style.transform = transform;
};

// Reset, if mouse leaves window
document.onmouseleave = () => {
    bg.style.transform = '';
};

// (opt) event, text as return value
ipcRenderer.on('updateCheck', (event, stage, progress) => {
    // changes the text of the button
    const downloadWrapper = document.getElementById('download-progress');
    const download = document.getElementById('download-progress-bar');
    switch (stage) {
        case 'checking':
            download.innerHTML = '<span>Checking for update...</span>';
            console.log('checking');
            break;
        case 'available':
            download.innerHTML = '<span>Update available!</span>';
            console.log('available');
            break;
        case 'not-available':
            download.innerHTML = '<span>Update not available.</span>';
            console.log('not-available');
            setTimeout(() => {
                downloadWrapper.classList.remove('visible');
            }, 3000);
            break;
        case 'in-progress':
            console.log('in-progress');
            download.style.width = `${progress.percent}%`;
            download.setAttribute('aria-valuenow', progress.percent);
            download.innerHTML = `<span>${progress.percent.toFixed(1)}% - ${(progress.bytesPerSecond / 1000).toFixed(0)} KB/s</span>`;
            break;
        case 'downloaded':
            console.log('downloaded');
            download.innerHTML = '<span>Please restart to update.</span>';
            break;
        default:
            break;
    }
});

// (opt) event, text as return value
ipcRenderer.on('updateReady', () => {
    // changes the text of the button
    const container = document.getElementById('ready');
    container.innerHTML = 'new version ready!';
});

/*
 * Open external links in browser
 */
Array.from(openInBrowserLink).forEach((el) => {
    el.addEventListener('click', (event) => {
        event.preventDefault();
        shell.openExternal(event.srcElement.offsetParent.lastElementChild.href)
            .catch((error) => {
                log.error(error);
            });
    });
});



function traverseFileTree(item, path) {
    const exclude = ['.DS_Store'];
    path = path || '';
    if (item.isFile) {
        // Get file
        item.file(function(file) {
            if (fs.statSync(file.path).isDirectory() || exclude.includes(file.name)) {
                dragzone.classList.remove('drag-active');

                return false;
            }
            ipcRenderer.send('shrinkImage', file.name, file.path, file.lastModified);
        });
    } else if (item.isDirectory) {
        // Get folder contents
        var dirReader = item.createReader();
        dirReader.readEntries(function(entries) {
            for (let i in entries) {
                traverseFileTree(entries[i], path + item.name + '/');
            }
        });
    }
}

/*
 * Cut path from beginning, if necessary
 * return string
 */
function cutFolderName(path) {
    let length = path.length;
    if (length >= 48) {
        path = '... ' + path.substr(length - 48);
    }

    return path;
}

/*
 * Testcase ResizeObserver
 * will be included when electron implements Chrome 64
 */
const chromeVersion = process.versions.chrome.split('.', 1)[0];
if (chromeVersion > 64) {
    const ro = new ResizeObserver(entries => {
        for (const entry of entries) {
            const cr = entry.contentRect;
            log.info('Element:', entry.target);
            log.info(`Element size: ${cr.width}px × ${cr.height}px`);
            log.info(`Element padding: ${cr.top}px ; ${cr.left}px`);
        }
    });

    // Observe one or multiple elements
    ro.observe(document.body);
}
