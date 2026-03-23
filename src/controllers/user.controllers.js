import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResposnse.js";
import jwt from "jsonwebtoken"
import mongoose from "mongoose";

const generateAccessAndRefereshTokens = async (userId)=>{
    try{                                    
        console.log("ACCESS SECRET:", process.env.ACCESS_TOKEN_SECRET)     // add
        console.log("REFRESH SECRET:", process.env.REFRESH_TOKEN_SECRET)   // add
        const foundUser = await User.findById(userId)
        const accessToken = foundUser.generateAccessToken()
        const refreshToken = foundUser.generateRefreshToken()
        foundUser.refreshToken = refreshToken
        await foundUser.save({ validateBeforeSave: false })
        return {accessToken,refreshToken}
    }catch(error){
         console.log("🔥 REAL ERROR FULL:", error)
    console.log("🔥 MESSAGE:", error.message)
        throw new ApiError(500,"something went wrong while generating access token and refresh token")
    }

}

const registerUser = asyncHandler(async (req,res)=>{
    // get user details from frontend
    // validation - not empty
    // check if user already exists: username, email
    // check for images, check for avatar
    // upload them to cloudinary, avatar
    // create user object - create entry in db
    // remove password and refresh token field from response
    // check for user creation
    // return res


    const {fullName, email, username, password } = req.body
    //console.log("email: ", email);

    if (
        [fullName, email, username, password].some((field) => field?.trim() === "")
    ) {
        throw new ApiError(400, "All fields are required")
    }

    const existedUser = await User.findOne({
        $or: [{ username }, { email }]
    })

    if (existedUser) {
        throw new ApiError(409, "User with email or username already exists")
    }
    //console.log(req.files);

    const avatarLocalPath = req.files?.avatar[0]?.path;
    //const coverImageLocalPath = req.files?.coverImage[0]?.path;

    let coverImageLocalPath;
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage[0].path
    }
    

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is required")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if (!avatar) {
        throw new ApiError(400, "Avatar file is please give required")
    }
   

    const user = await User.create({
        fullName,
        avatar: avatar.secure_url,
coverImage: coverImage?.secure_url || "",
        email, 
        password,
        username: username.toLowerCase()
    })

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if (!createdUser) {
        throw new ApiError(500, "Something went wrong while registering the user")
    }

    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered Successfully")
    )

} )

const loginUser = asyncHandler(async (req,res)=>{
    //req body->data
    //username or email
    //find the user
    //password check
    //access and refresh token
    //send cookie
    console.log("LOGIN HIT")           // add this
    console.log("BODY:", req.body) 
    const {username,email,password} = req.body

    if(!username && !email){
        throw new ApiError(400,"Username or email is required")
    }
    const user = await User.findOne({
        $or:[{username},{email}]
    })
    if(!user){
        throw new ApiError(404,"User not found with the provided email or username")
    }
    const isPasswordValid = await user.isPasswordCorrect(password)
    if(!isPasswordValid){
        throw new ApiError(400,"password  is incorrect")
    }
    console.log("Logged in hit")
    const {accessToken,refreshToken} = await generateAccessAndRefereshTokens(user._id)
    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")
    const options ={
        httpOnly:true,
        secure: true,
    }
    return res.status(200).cookie("accessToken",accessToken,options)
    .cookie("refreshToken",refreshToken,options)
    .json(
        new ApiResponse(
            200,
            {
                user:loggedInUser,
                accessToken,
                refreshToken
            },
            "User Logged in successfully"
        )
    )
})

const logoutUser = asyncHandler(async(req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset: {
                refreshToken: 1 // this removes the field from document
            }
        },
        {
            new: true
        }
    )

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged Out"))
})

const refreshAccessToken = asyncHandler(async(req,res)=>{
    const incomingRefreshToken =req.cookies?.refreshToken || req.body.refreshToken
    if(incomingRefreshToken){
        throw new ApiError(401,"unauthorized request")
    }
   const decodedToken = jwt.verify(
        incomingRefreshToken,
        process.env.REFRESH_TOKEN_SECRET
    )
    const user = await User.findById(decodedToken?._id)
    if(!user){
        throw new ApiError(401,"invalid refresh token")
    }
    if(incomingRefreshToken !== user.refreshToken){
        throw new ApiError(401,"Refresh token is expired or used")
    }
const options = {
    httpOnly:true,
    secure:true
}
const {newaccessToken,newrefreshToken} = await generateAccessAndRefereshTokens(user._id)
try{
return res.status(200)
          .cookie("accessToken",accessToken,options)
          .cookie("refreshToken",refreshToken,options)
          .json(
            new ApiResponse(
                200,
                {
                    accessToken,
                    refreshToken:newrefreshToken
                }
            )
          )
        }catch(error){
            throw new ApiError(401,error?.message || "Invalid refresh token")
        }
})
const ChangeCurrentPassword = asyncHandler(async(req,res)=>{
    const {oldPassword,newPassword} = req.body
    const user = await User.findById(req.user?._id)
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)
    if(!isPasswordCorrect){
        throw new ApiError(400,"Invalid old password")
    }
    user.password = newPassword
    await user.save({validateBeforeSave:false})

    return res.status(200)
              .json(new ApiResponse(200,{},"Password changed successfully"))
})

const getCurrentUser = asyncHandler(async(req,res)=>{
    return res.status(200)
              .json(new ApiResponse(200,req.user,"Current user fetched successfully"))
})
const updateAccountDetails = asyncHandler(async(req,res)=>{
    const {fullName,username,email} = req.body
    if(!fullName || !email){
        throw new ApiError(400,"All fields are required")
    }
    const user  =  await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                fullName,
                email:email
            }
        },
        {new:true}
    ).select("-password")
    return res.status(200)
              .json(new ApiResponse(200,user,"Account details updated successfully"))
})
const updateUserAvatar = asyncHandler(async(req,res)=>{
    const avatarLocalPath = req.field?.path
    if(!avatarLocalPath){
        throw new ApiError(400,"Avatar file is missing")
    }
    const avatar = await uploadOnCloudinary(avatarLocalPath)
    if(!avatar.url){
        throw new ApiError(400,"Error while uploading avatar")
    }
    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                avatar:avatar.url
            }
        },{new:true}
    ).select("-passowrd")
    return res.status(200)
              .json(
                new ApiResponse(200,user,"Avatar updation succesfully")
              )
})

const updateUserCoverImage = asyncHandler(async(req, res) => {
    const coverImageLocalPath = req.file?.path

    if (!coverImageLocalPath) {
        throw new ApiError(400, "Cover image file is missing")
    }



    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if (!coverImage.url) {
        throw new ApiError(400, "Error while uploading on avatar")
        
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                coverImage: coverImage.url
            }
        },
        {new: true}
    ).select("-password")

    return res
    .status(200)
    .json(
        new ApiResponse(200, user, "Cover image updated successfully")
    )
})

const  getuserChannelProfile = asyncHandler(async(req,res)=>{
        const {username} = req.params
        if(!username?.trim()){
            throw new ApiError(400,"username is missing")
        }
        const channel = await User.aggregate([
            {
                $match:{
                    username: username?.toLowerCase()
                }
            },
            {
                $lookup:{
                    form:"Subscription",
                    localField:"_id",
                    foreignField:"channel",
                    as:"subscribers"
                }
            },
            {
                $lookup:{
                    from:"Subscription",
                    localField:"_id",
                    foreignField:"subsciber",
                    as:"subscirbedto"
                }
            },
            {
                $addFields:{
                    SubscribersCount:{
                        $size:"$subscribers"
                    },
                    channelSubscibedToCount:{
                        $size:"$subscirbedto"
                    },
                    isSubscribed:{
                        $cond:{
                            if:{$in:[req.user?._id,"$subscirbers.subsciber"]},
                            then:true,
                            else:false
                        }
                    }
                }
            },
            {
                $project:{
                    fullName:1,
                    username:1,
                    SubscribersCount:1,
                    channelSubscibedToCount:1,
                    isSubscribed:1,
                    avatar:1,
                    coverImage:1,
                    email:1
                }
            }
        ])
        if(!channel?.length){
            throw new ApiError(401,"channel does not exist")
        }
        return res.status(200)
                  .json(
                    new ApiResponse(200,channel[0],"user channel fetched succesfully")
                  )
})

const getwatchHistory = asyncHandler(async(req,res)=>{
    const user = await User.aggregate([
        {
            $match:{
                _id: new mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            $lookup:{
                from:"Video",
                localField:"watchHistory",
                foreignField:"_id",
                as:"watchHistory",
                pipeline:[
                    {
                        $lookup:{ 
                            from:"User",
                            localField:"owner",
                            foreignField:"_id",
                            as:"owner",
                            pipeline:[
                                {
                                    $project:{
                                        fullName:1,
                                        username:1,
                                        avatar:1
                                    }
                                }
                            ]
                        }
                    },
                    {
                    $addFields:{
                    owner:{ $first:"$owner" }
                    }
                    }
                ]
            }
        },
        
    ])
    return res.status(200)
              .json(
                new ApiResponse(
                    200,
                    user[0].watchHistory,
                    "watch history fetched succefully"
                )
              )
})






export {registerUser,loginUser,logoutUser,refreshAccessToken,
    ChangeCurrentPassword,getCurrentUser,updateAccountDetails,
    updateUserAvatar,updateUserCoverImage,getuserChannelProfile}