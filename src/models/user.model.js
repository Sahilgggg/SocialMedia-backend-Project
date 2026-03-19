import mongoose,{Schema} from "mongoose";
import jwt from "jsonwebtoken"
import bcrypt from "bcrypt"


const UserSchema = new Schema({
    username:{
        type : String,
        required: true,
        unique: true,
        lowercase:true,
        trim:true,
        index:true              // for faster search
    },
    email:{
        type:String,
        required:true,
        unique:true,
        lowercase:true,
        trim:true,
    },
    fullName:{
        type: String,
        required:true,
        trim:true,
        index:true
    },
    avatar:{
        type:String,
        required:true,
    },
    coverImage:{
        type:String,
    },
    watchHistory:[
        {
            type:Schema.Types.ObjectId,
            ref:"Video"
        }
    ],
    password:{
        type:String,
        required:[true,"password is required"],
    },
    refreshToken:{
        type:String
    },
},{timestamps:true})

//pre hook is used to hash the user password before saving it to the database
//hash helps to protect user password
UserSchema.pre("save", async function () {
    if (!this.isModified("password")) return;
    this.password = await bcrypt.hash(this.password, 10);
});

UserSchema.methods.isPasswordCorrect = async function (password) {
return await bcrypt.compare(password,this.password)
}
UserSchema.methods.genrateAccessToken = function(){
  return  jwt.sign(
        {
            _id:this._id,
            username:this.username,
            email:this.email,
            fullName:this.fullName
        },
        process.env.ACCESS_TOKEN_SECRET,
        {
            expiresIn:process.env.ACCESS_TOKEN_EXPIRE
        }
    )
}

UserSchema.methods.genrateRefreshToken = function(){
    return jwt.sign(
        {
            _id:this._id,
        },
        process.env.REFRESH_TOKEN_SECRET,
        {
            expiresIn:process.env.REFRESH_TOKEN_EXPIRE
        }
    )
}


export const User = mongoose.model('User', UserSchema)