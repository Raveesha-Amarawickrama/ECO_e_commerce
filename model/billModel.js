import mongoose from "mongoose";
import User from "./userModel.js";
import Order from "./orderModel.js";

const billSchema= new mongoose.Schema({
    user:{
        type:mongoose.Schema.Types.ObjectId,
        ref:User,
        required:true
    },
    order:{
        type:mongoose.Schema.Types.ObjectId,
        ref:Order,
        required:true
    },
    firstName:{
        type:String,
        required:[true,"enter your name"]
    },
    companyName:{
        type:String,
        required:[true,"enter company name"]
    },
    streetAddress:{
        type:String,
        required:[true,"enter street"]
    },
    floor:{
        type:String
    },
    city:{
        type:String,
        required:[true,"enter city"]
    },
    phoneNumber:{
        type:String,
        required:[true,"enter phone number"]
    },
    email:{
        type:String,
        required:[true,"enter gmail"]
    }

})

const Bill=mongoose.model('bill',billSchema);

export default Bill;