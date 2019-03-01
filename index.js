const fs = require('fs');
const readline = require('readline');

//sets the start time so we get, debugging info about time/duration
const timeStampStart = Date.now();
let timeStampEnd = 0;

function readFile(path) {
    return new Promise((resolve, reject) => {
        const readStream = fs.createReadStream(path,
            { encoding: "utf8" });

        let fileData = "";

        readStream.on('data', (data) => {
            if (data && data !== undefined)
                fileData += data;
        });
        readStream.on('end', () => {
            resolve(fileData);
            console.log(`File Reading Done from ${path}`);
        });

        readStream.on('error', (error) => {
            reject(error);
        });
    })
}

const photosArray = []; // holds all the photos
const tagsToPhotos = new Map(); // holds tag > photoId<Array> for horizontal photos
const tagsToPhotosVertical = new Map(); // holds tag > photoId<Array> for vertical photos
const singleVerticalPhotos = []; // vertical photos that might not get linked
// we combine two of each of above to create a slide
const slides = []; // holds the slides that were created


// Photo data are stored in the photos class
class Photo {
    constructor(id, orientation, noOfTags, tags) {
        this.id = id;
        this.orientation = orientation;
        this.noOfTags = noOfTags;
        this.tags = tags;
        this.isUsed = false;
    }
    setIsUsed() {
        this.isUsed = true;
    }
}

// Slide data are stored in the slide class
class Slide {
    constructor(...photos) {
        this.photos = [...photos];
    }

    returnValue() {
        let value = [];

        this.photos.forEach(
            element => {
                value.push(element.id);
            }
        )
        return value.join(' ');
    }
}

/**
 * Accepts raw data and convert it to an Array of usable photo objects
 * And also populates the tag > ids maps for the respective orientations
 * @param {PlainData} data 
 */
function processData(data) {
    console.log('Processing Data File.')
    const ArrayTemp = [...data];
    let rows = ArrayTemp.shift();
    console.log('Rows', rows);
    let invalid_data = ArrayTemp.pop();
    if (invalid_data !== '' && invalid_data) ArrayTemp.push(invalid_data);
    //console.log(ArrayTemp)
    for (let x = 0; x < rows; x++) {
        // debbug
        let time = ((Date.now() - timeStampStart) / 1000) < 60 ?
         ((Date.now() - timeStampStart) / 1000) + 's' :
         (((Date.now() - timeStampStart) / 1000) / 60) + 'm';
         console.log(`Processing ${x} of ${rows} -`, `Time took so far ${time}`);
         // time

        let tmpPhoto = ArrayTemp[x];
        let tmpPhotoProps = tmpPhoto.split(' ');
        let photoAlign = tmpPhotoProps.shift();
        let photoTagsNo = tmpPhotoProps.shift();
        let photo = new Photo(x, photoAlign, photoTagsNo, tmpPhotoProps);
        photo.tags.forEach((element) => {
            if (photo.orientation === 'H') {
                if (!tagsToPhotos.has(element))
                    tagsToPhotos.set(element, [photo.id]);
                else tagsToPhotos.get(element).push(photo.id);
            } else if (photo.orientation === 'V') {
                if (!tagsToPhotosVertical.has(element))
                    tagsToPhotosVertical.set(element, [photo.id]);
                else tagsToPhotosVertical.get(element).push(photo.id);
            }
        });
        photosArray.push(photo);
    }

    console.log('File Data Processing Done.')

    // Maps done, photo vals are available
    console.log('Finding Interest Between Photos.')
    for (let x = 0; x < rows; x++) {
        // debbug
        let time = ((Date.now() - timeStampStart) / 1000) < 60 ?
         ((Date.now() - timeStampStart) / 1000) + 's' :
         (((Date.now() - timeStampStart) / 1000) / 60) + 'm';
         console.log(`Processing Interest of Photo ${x} of ${rows} -`, `Time took so far ${time}`)
        // time

        let photo = photosArray[x];
        if (photo.orientation == 'H')
            findSeriesandAddSlide(photo, tagsToPhotos)
        else if (photo.orientation == 'V')
            findSeriesandAddSlide(photo, tagsToPhotosVertical)
    }
    console.log('Finding Interest Between Photos Done')
}

/**
 * finds the most interested photo to come after the one before
 * and makes a slide with it, and sets the isUsed flag of the photo to used
 * @param {Photo} photo 
 * @param {Map<tag,Array[...ids]>} tagsToPhotos 
 */
function findSeriesandAddSlide(photo, tagsToPhotos) {
    let photoTags = photo.tags;
    let interest;
    if (photo.isUsed) return true;

    for (let y = 0; y < photoTags.length; y++) {
        // iterate through the photos tags array of the specified photo 
        let photoIds = tagsToPhotos.get(photoTags[y]);
        let photoInterest = []

        // iterate through the photos that might have a link
        // iterating through photoId to find similar photos
        photoIds.forEach((idOfPhoto) => {
            if (idOfPhoto !== photo.id) {
                let photo2 = photosArray[idOfPhoto];
                if (!photo2.isUsed) {
                    let photoToPhoto2Intersection = intersectionSet(photo.tags, photo2.tags);
                    let photoToPhoto2Difference = setDifference(photo.tags, photo2.tags);
                    let photo2ToPhotoDifference = setDifference(photo2.tags, photo.tags);
                    let minValue = photoToPhoto2Intersection;
                    if (minValue > photo2ToPhotoDifference) {
                        minValue = photo2ToPhotoDifference;
                    }
                    if (minValue > photoToPhoto2Difference) {
                        minValue = photo2ToPhotoDifference;
                    }
                    photoInterest.push({
                        leftId: photo.id,
                        rightId: photo2.id,
                        minValue
                    });
                }
            }
        });

        // now if the list of the photos we r interested in is larger
        // than 0 then we iterate through it
        if (photoInterest.length > 0)
            photoInterest.forEach((element) => {
                if (interest === undefined || !interest) {
                    interest = element;
                } else {
                    if (interest.minValue < element.minValue)
                        interest = element;
                }
            });
    }

    // expermintal
    if (!interest) { // this means the photo link are all used or has no link
        //so we just add it for now
        if (!photo.isUsed) {
            if (photo.orientation == 'H')
                slides.push(new Slide(photo));
            else if (photo.orientation == 'V') {
                if (singleVerticalPhotos.length == 0)
                    singleVerticalPhotos.push(photo);
                else {
                    let photoFromArray = singleVerticalPhotos.pop();
                    slides.push(new Slide(photoFromArray, photo));
                }
            }
            photo.setIsUsed();
        }
        return true;
    }

    let { leftId, rightId } = interest;
    let leftPhoto = photosArray[leftId];
    let rightPhoto = photosArray[rightId];

    // expermintal
    if (leftPhoto.orientation == 'V' && rightPhoto.orientation == 'V') {
        leftPhoto.setIsUsed();
        rightPhoto.setIsUsed();
        slides.push(new Slide(leftPhoto, rightPhoto));

    }  // expermintal
    else if (leftPhoto.orientation == 'H' && rightPhoto.orientation == 'H') {
        leftPhoto.setIsUsed();
        rightPhoto.setIsUsed();
        slides.push(new Slide(leftPhoto));
        slides.push(new Slide(rightPhoto));
    }
}


function intersectionSet(a, b) {
    let intersection = new Set(
        [...a].filter(x => b.includes(x)));
    return intersection.size;
}

function setDifference(a, b) {
    let difference = new Set(
        [...a].filter(x => !b.includes(x)));
    return difference.size;
}

/**
 * writes the data we computed to a file
 * @param {Slide[]} slidesParam 
 * @param {String} name 
 */
function writeFile(slidesParam, name, debug) {
    console.log(`Writing ${debug || ''} File`, name);
    const outputDir = './outputs/';

    !fs.existsSync(outputDir) && fs.mkdirSync(outputDir);

    const writeStream = fs.createWriteStream(`${outputDir}${name}.${debug || 'out'}`, { flags: 'a' });
    if (!debug) {
        writeStream.write(`${slidesParam.length}\n`)
        slidesParam.forEach(element => {
            const valueToWrite = element.returnValue();
            writeStream.write(valueToWrite + '\n');

        });
    } else {
        // this one just writes a series of debugs for fun :D
        writeStream.write(`No.Photos: ${photosArray.length}\n`);
        writeStream.write(`StartTimestamp: ${timeStampStart}\n`);
        writeStream.write(`EndTimestamp: ${timeStampEnd}\n`);
        writeStream.write(`Took: ${timeStampEnd - timeStampStart}ms\n`);
        writeStream.write(`No.Slides: ${slidesParam.length}\n`);
        writeStream.write(`By *Bainjan* Group\n`);
    }
    console.log(`${debug || ''} File is written`);
    writeStream.end();
}

function main() {
    let r1 = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    r1.question('Enter the input filename (without extension)\n', (answer) => {
        readFile(`./inputs/${answer}.txt`)
            .then((fileData) => {
                let fileArray = fileData.split('\n');
                processData(fileArray);
                console.log(`No of Slides Generated [${slides.length}]`)
                writeFile(slides, answer);
                timeStampEnd = Date.now();
                writeFile(slides, answer, 'debug');
                console.log(`Operation took ${timeStampEnd - timeStampStart}ms`);
                r1.close();
            })
            .catch((error) => {
                console.log(`File Reading failed reason : ${error.message}`);
                r1.close();
            });
    });
}

main();
