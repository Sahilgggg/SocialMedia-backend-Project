import mongoose,{Schema} from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate";
const  VideoSchema = new Schema({
    videofile:{
        type:String, // cloudinary
        required:true
    },
    thumbnail:{
        type:String,
        required:true
    },
    title:{
        type:String,
        required:true,
    },
    discription:{
        type:String,
        required:true
    },
    duration:{
        type:Number,
        required:true
    },
    views:{
        type:Number,
        default:0
    },
    ispublished:{
        type:Boolean,
        default:false
    },
    owner: {
            type: Schema.Types.ObjectId,
            ref: "User"
        }

},{timestamps:true}
)
VideoSchema.plugin(mongooseAggregatePaginate)
//the mongoose-aggregate-paginate is a plugin for mongoose that provides pagination capabilities for aggregate queries.
export const Video = mongoose.model('Video', VideoSchema)