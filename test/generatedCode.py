
import torch.nn

class MyModel(torch.nn.Module):
    def __init__(self):
        super().__init__()
        self.node1 = torch.nn.Conv2d(in_channels=1,out_channels=1,kernel_size=1,stride=1)
        self.node2 = torch.nn.AvgPool2d(kernel_size=(1,1),ceil_mode=True)
        self.node3 = torch.nn.Identity()
        self.node4 = torch.nn.L1Loss()
    def forward(self, x):
        y = self.node1(input=x[0])
        z = self.node2(input=y)
        a = self.node3(input=x[1])
        b = self.node4(input=z,target=a)
        return b