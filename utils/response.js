

const success = (message, statusCode) => {
    return {
        success : true,
        status: statusCode,
        body : message,
    }
}

const error = (message, statusCode) => {
    return {
        error: true,
        status:statusCode,
        body: message,
    }
}

module.exports = {
    success,
    error,
}