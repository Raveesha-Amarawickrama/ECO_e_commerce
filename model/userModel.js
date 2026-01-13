import mongoose from "mongoose";

const userSchema= new mongoose.Schema({
    name:{
        type:String,
        required:[true,'name is required']
    },
    username:{
        type:String,
        required:[true,"please enter your username"]
    },
    phoneNo:{
        type:Number,
        required:[true,'please enter your number']
    },
    password:{
        type:String,
        required:[true,"please enter password"],
        minlength:8,
        // select:false
    },
    verified: { type: Boolean, default: false },
    isActive: {
        type: Boolean,
        default: true,
        // select:false
      },
    role:{
        type:String,
        default:'user'
    },
     resetPasswordToken: String,
  resetPasswordExpire: Date,
})


const User=mongoose.model('user',userSchema);
export default User;