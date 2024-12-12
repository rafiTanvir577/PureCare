const { MULTER_FILE_DESTINATION, MULTER_FILE_SIZE, MULTER_CERTIFICATES_DESTINATION } = process.env;

export const multerConfig = {
    dest: MULTER_FILE_DESTINATION || 'src/public/assets',
    certificatesDest: MULTER_CERTIFICATES_DESTINATION || 'src/public/certificates',
    maxFileSize: Number(MULTER_FILE_SIZE) || 3 * 1024 * 1024, // 3 MB
}